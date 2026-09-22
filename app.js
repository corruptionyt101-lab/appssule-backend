const createError = require("http-errors");
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const cors = require("cors");
const indexRouter = require("./routes/index");
const usersRouter = require("./routes/users");
const teapot = require("./routes/teapot");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const DBConnect = require("./database/db");
const authRouter = require("./routes/auth");
const chatRouter = require("./routes/chat.js");
const adminRouter = require("./routes/admin.js");
const friendsRouter = require("./routes/friends.js");
const notificationsRouter = require("./routes/notifications.js");
const hubsRouter = require("./routes/hubs.js");
const dmRouter = require("./routes/dm.js");
const rewardsRouter = require("./routes/rewards.js");
const meRouter = require("./routes/me.js");
const socialRouter = require("./routes/social.js");
const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL.split(","), credentials: true }));
const limit = rateLimit({
  windowMs: 60 * 1000,
  max: 4,
  handler: (req, res, next) => {
    res
      .status(429)
      .json({ error: "Too many requests. Wait a couple of minutes." });
  },
});
app.use((req, res, next) => {
  if(process.env.STATUS === "development")return next();
  if(!(["/admin", "/admin/"].includes(req.originalUrl)) && req.method !== "GET" && req.path !== "/api/auth"){
    return limit(req, res, next);
  }
  return next();
});

app.options(
  "*",
  cors({
    origin: process.env.FRONTEND_URL.split(","),
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());

//<Database and such>
  app.use(mongoSanitize());
  DBConnect();
//</Database and such>
//<App setup>
app.set("trust proxy", true);
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "jade");
app.use(logger("dev"));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/api/users", usersRouter);
app.use("/api/chat", chatRouter);
app.use("/api", indexRouter);
app.use("/secret", teapot);
app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/friends", friendsRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/hubs", hubsRouter);
app.use("/api/dm", dmRouter);
app.use("/api/rewards", rewardsRouter);
app.use("/api/auth/me", meRouter);
app.use("/api/social", socialRouter);
//</App setup>
//<error stuff (came with express generator)>
app.use((req, res, next) => {
  next(createError(404));
});
app.use((err, req, res, next) => {
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  res.status(err.status || 500);
  res.render("error");
});
//</erorr stuff>
module.exports = app;
