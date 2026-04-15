const { deleteFileIfExists } = require("../functions/common");
const User = require("../models/user");

exports.updateMyProfilePic = async (req, res) => {
  try {
    const userId = req.user._id;

    if (!req.file) {
      return res.status(400).json({
        message: "Profile image is required",
      });
    }

    const newProfilePic =
      req.file.path || req.file.location || req.file.url;

    const user = await User.findOne({
      _id: userId,
      isDeleted: false,
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.profilePic) {
      deleteFileIfExists(user.profilePic);
    }

    user.profilePic = newProfilePic;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Profile picture updated successfully",
      profilePic: newProfilePic,
    });
  } catch (error) {
    console.error("Update profile pic error:", error);
    return res.status(500).json({
      message: "Failed to update profile picture",
    });
  }
};
