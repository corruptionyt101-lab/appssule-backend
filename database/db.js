const mongoose = require("mongoose");
const DBConnect = async () => {
  try {
    await mongoose.connect(process.env.MONGODB);
    console.log("Database connected");
  } catch (error) {
    console.log("Error with database, error : ", error);
    process.exit(1);
  }
};
module.exports = DBConnect;