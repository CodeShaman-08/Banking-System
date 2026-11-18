const mongoose = require ("mongoose")

const ledgerSchema= new mongoose.Schema({
    account:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"account",
        required:[true,"ledger must be Associated with an account"],
        index:true,
        immutable:true
    },
    amount:{
        type:Number,
        required:[true,"Amount is required for creating a ledger entry"],
        immutable:true
    },
    transaction:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"transaction",
        required:[true,"ledger must be associated with a atransactioin"],
        index:true,
        immutable:true
    },
    type:{
    type:String,
    enum:{
        values:["CREDIT","DEBIT"],
        message:"type can be either CREDIT or DEBITD"
    }, 
    required:[true,"ledger type is required"],
    immutable:true
  }
})

function preventLedgerModification(){
    throw new Error("ledger entries are immutable and cannot be modified");
}
ledgerSchema.pre('findOneAndUpdate',preventLedgerModification);
ledgerSchema.pre('updateOne',preventLedgerModification);
ledgerSchema.pre('deleteOne',preventLedgerModification);
ledgerSchema.pre('remove',preventLedgerModification);
ledgerSchema.pre('deleteMany',preventLedgerModification);
ledgerSchema.pre('updateMany',preventLedgerModification);
ledgerSchema.pre('findOneAndDelete',preventLedgerModification);
ledgerSchema.pre('findOneAndReplace',preventLedgerModification);


const ledgerModel = mongoose.model('ledger',ledgerSchema);
module.exports = ledgerModel;