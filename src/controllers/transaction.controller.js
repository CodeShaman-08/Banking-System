const transactionModel = require("../models/transaction.model");
const ledgerModel = require("../models/ledger.model");
const accountModel = require("../models/account.model");
const mongoose = require("mongoose");

function isValidAmount(amount) {
  return typeof amount === "number" && Number.isFinite(amount) && amount > 0;
}

// Create a transfer between two accounts (double-entry: one DEBIT + one CREDIT).
async function createTransaction(req, res) {
  const { fromAccount, toAccount, amount, idempotencyKey } = req.body;

  if (!fromAccount || !toAccount || !idempotencyKey) {
    return res.status(400).json({
      message: "fromAccount, toAccount, amount and idempotencyKey required",
    });
  }
  if (!isValidAmount(amount)) {
    return res.status(400).json({
      message: "amount must be a positive number",
    });
  }
  if (String(fromAccount) === String(toAccount)) {
    return res.status(400).json({
      message: "fromAccount and toAccount must be different",
    });
  }

  // Idempotency: the same key must never move money twice.
  const isTransactionAlreadyExists = await transactionModel.findOne({
    idempotencyKey,
  });
  if (isTransactionAlreadyExists) {
    if (isTransactionAlreadyExists.status === "COMPLETED") {
      return res.status(200).json({
        message: "transaction is already processed",
        transaction: isTransactionAlreadyExists,
      });
    }
    if (isTransactionAlreadyExists.status === "PENDING") {
      return res.status(200).json({
        message: "transaction is still processing",
      });
    }
    if (isTransactionAlreadyExists.status === "FAILED") {
      return res.status(500).json({
        message: "transaction failed, retry with a new idempotency key",
      });
    }
    if (isTransactionAlreadyExists.status === "REVERSED") {
      return res.status(500).json({
        message: "transaction is reversed",
      });
    }
  }

  const fromUserAccount = await accountModel.findOne({ _id: fromAccount });
  const toUserAccount = await accountModel.findOne({ _id: toAccount });
  if (!fromUserAccount || !toUserAccount) {
    return res.status(400).json({
      message: "invalid fromAccount or toAccount",
    });
  }

  // Ownership check: you can only spend from an account you own.
  if (String(fromUserAccount.user) !== String(req.user._id)) {
    return res.status(403).json({
      message: "you can only transfer from your own account",
    });
  }

  if (
    fromUserAccount.status !== "ACTIVE" ||
    toUserAccount.status !== "ACTIVE"
  ) {
    return res.status(400).json({
      message: "both accounts must be ACTIVE",
    });
  }

  // Balance is derived from the ledger, never stored on the account.
  const balance = await fromUserAccount.getBalance();
  if (balance < amount) {
    return res.status(400).json({
      message: "insufficient balance",
    });
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const transaction = (
      await transactionModel.create(
        [
          {
            fromAccount,
            toAccount,
            amount,
            idempotencyKey,
            status: "PENDING",
          },
        ],
        { session },
      )
    )[0];

    await ledgerModel.create(
      [
        {
          account: fromAccount,
          amount,
          transaction: transaction._id,
          type: "DEBIT",
        },
        {
          account: toAccount,
          amount,
          transaction: transaction._id,
          type: "CREDIT",
        },
      ],
      { session, ordered: true },
    );

    transaction.status = "COMPLETED";
    await transaction.save({ session });
    await session.commitTransaction();

    return res.status(201).json({
      message: "transaction completed successfully",
      transaction,
    });
  } catch (error) {
    await session.abortTransaction();

    // A concurrent request with the same idempotency key won the race.
    if (error.code === 11000) {
      const existing = await transactionModel.findOne({ idempotencyKey });
      return res.status(200).json({
        message: "transaction is already processed",
        transaction: existing,
      });
    }

    return res.status(500).json({
      message: "transaction failed",
    });
  } finally {
    await session.endSession();
  }
}

// System-only endpoint used to mint initial funds into an account.
async function createInitialFundsTransaction(req, res) {
  const { toAccount, amount, idempotencyKey } = req.body;
  if (!toAccount || !idempotencyKey) {
    return res.status(400).json({
      message: "toAccount, amount and idempotencyKey are required",
    });
  }
  if (!isValidAmount(amount)) {
    return res.status(400).json({
      message: "amount must be a positive number",
    });
  }

  const toUserAccount = await accountModel.findOne({ _id: toAccount });
  if (!toUserAccount) {
    return res.status(400).json({
      message: "Invalid toAccount",
    });
  }

  const fromUserAccount = await accountModel.findOne({
    user: req.user._id,
    status: "ACTIVE",
  });
  if (!fromUserAccount) {
    return res.status(400).json({
      message: "System user account not found",
    });
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const transaction = new transactionModel({
      fromAccount: fromUserAccount._id,
      toAccount,
      amount,
      idempotencyKey,
      status: "PENDING",
    });
    await transaction.save({ session });

    await ledgerModel.create(
      [
        {
          account: fromUserAccount._id,
          amount,
          transaction: transaction._id,
          type: "DEBIT",
        },
        {
          account: toAccount,
          amount,
          transaction: transaction._id,
          type: "CREDIT",
        },
      ],
      { session, ordered: true },
    );

    transaction.status = "COMPLETED";
    await transaction.save({ session });
    await session.commitTransaction();

    return res.status(201).json({
      message: "initial funds transaction completed successfully",
      transaction,
    });
  } catch (error) {
    await session.abortTransaction();
    if (error.code === 11000) {
      return res.status(200).json({
        message: "transaction is already processed",
      });
    }
    return res.status(500).json({ message: "transaction failed" });
  } finally {
    await session.endSession();
  }
}

module.exports = {
  createTransaction,
  createInitialFundsTransaction,
};
