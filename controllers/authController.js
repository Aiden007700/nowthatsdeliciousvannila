const passport = require("passport");
const crypto = require("crypto");
const mongoose = require("mongoose");
const User = mongoose.model("User");
const promisify = require("es6-promisify");
const mail = require("../handlers/mail");

exports.login = passport.authenticate("local", {
  failureRedirect: "/login",
  failureFlash: "Faild Login!",
  successRedirect: "/",
  successFlash: "You Are now logged in!"
});

exports.logout = (req, res, next) => {
  req.logout();
  req.flash("success", "You are now logged out!");
  res.redirect("/");
  return;
};

exports.isLoggedIn = (req, res, next) => {
  if (req.isAuthenticated()) {
    next();
    return;
  }
  req.flash("error", "Oops! You must be loged in");
  res.redirect("/login");
};

exports.forgot = async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    req.flash("error", "A password reset has been maild to you");
    return res.redirect("/login");
  }
  user.resetPasswordToken = crypto.randomBytes(20).toString("hex");
  user.resetPasswordExpires = Date.now() + 3600000;
  await user.save();
const resetURL = `http://${req.headers.host}/account/reset/${
    user.resetPasswordToken
  }`;
  mail.send({
    user,
    subject: "Password Reset",
    resetURL,
    filename: "password-reset"
  });
  req.flash("success", `A password reset has been maild to you`);
  res.redirect("/login");
};

exports.reset = async (req, res, next) => {
  const user = await User.findOne({
    resetPasswordToken: req.params.token,
    resetPasswordExpires: { $gt: Date.now() }
  });
  if (!user) {
    req.flash("error", "Password reset is invalid or has expired");
    return res.redirect("/login");
  }
  res.render("reset", { title: "Password Reset" });
};

exports.confermedPasswords = (req, res, next) => {
  if (req.body.password === req.body["password-confrirm"]) {
    return next();
  }
  req.flash("error", "Passwords do not match!");
  res.redirect("back");
};

exports.update = async (req, res, next) => {
  const user = await User.findOne({
    resetPasswordToken: req.params.token,
    resetPasswordExpires: { $gt: Date.now() }
  });
  if (!user) {
    req.flash("error", "Password reset is invalid or has expired");
    return res.redirect("/login");
  }
  const setPassword = promisify(user.setPassword, user);
  await setPassword(req.body.password);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  const updatedUser = await user.save();
  await req.login(updatedUser);
  req.flash(
    "Success",
    "Nice! Your password has been reset! You are now logged in!"
  );
  res.redirect("/");
};
