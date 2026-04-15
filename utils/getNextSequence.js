const Sequence = require("../models/Sequence");

const getNextSequence = async (key, session = null) => {
  const seqDoc = await Sequence.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    {
      new: true,
      upsert: true,
      session,
    }
  );

  return seqDoc.seq;
};

module.exports = getNextSequence;
