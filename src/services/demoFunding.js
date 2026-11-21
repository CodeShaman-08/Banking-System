const crypto = require("crypto");
const mongoose = require("mongoose");

const userModel = require("../models/user.model");
const accountModel = require("../models/account.model");
const transactionModel = require("../models/transaction.model");
const ledgerModel = require("../models/ledger.model");

const SYSTEM_EMAIL = "system-bank@banking-system.dev";
const SYSTEM_USERNAME = "system-bank";

// Lazily create the bank's own account. It is the counter-party for demo
// funding, so every credit still has a matching debit (double-entry).
async function getOrCreateSystemAccount() {
  let systemUser = await userModel.findOne({ email: SYSTEM_EMAIL });

  if (!systemUser) {
    try {
      systemUser = await userModel.create({
        email: SYSTEM_EMAIL,
        username: SYSTEM_USERNAME,
        name: "System Bank",
        password: crypto.randomUUID(),
        systemUser: true,
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
      systemUser = await userModel.findOne({ email: SYSTEM_EMAIL });
    }
  }

  let systemAccount = await accountModel.findOne({ user: systemUser._id });
  if (!systemAccount) {
    systemAccount = await accountModel.create({ user: systemUser._id });
  }

  return systemAccount;
}

// Credit a newly created account with demo money so visitors can try a
// transfer immediately. Enabled with DEMO_FUNDING=true.
async function fundNewAccount(accountId, amount = 5000) {
  const systemAccount = await getOrCreateSystemAccount();
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const transaction = (
      await transactionModel.create(
        [
          {
            fromAccount: systemAccount._id,
            toAccount: accountId,
            amount,
            idempotencyKey: `demo-funds-${accountId}`,
            status: "PENDING",
          },
        ],
        { session },
      )
    )[0];

    await ledgerModel.create(
      [
        {
          account: systemAccount._id,
          amount,
          transaction: transaction._id,
          type: "DEBIT",
        },
        {
          account: accountId,
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
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
}

module.exports = { fundNewAccount, getOrCreateSystemAccount };
