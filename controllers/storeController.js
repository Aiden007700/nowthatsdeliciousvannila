const mongoose = require("mongoose");
const Store = mongoose.model("Store");
const User = mongoose.model("User");
const multer = require("multer");
const jimp = require("jimp");
const uuid = require("uuid");

const multerOptions = {
  storage: multer.memoryStorage(),
  fileFilter(req, file, next) {
    const isPhoto = file.mimetype.startsWith("image/");
    if (isPhoto) {
      next(null, true);
    } else {
      next({ message: "That filetype isn't allowed!" }, false);
    }
  }
};

exports.homePage = (req, res, next) => {
  res.render("index");
};

exports.addStore = (req, res, next) => {
  res.render("editStore", { title: "Add Store" });
};

exports.upload = multer(multerOptions).single("photo");

exports.resize = async (req, res, next) => {
  if (!req.file) {
    return next();
  }
  const extension = req.file.mimetype.split("/")[1];
  req.body.photo = `${uuid.v4()}.${extension}`;
  const photo = await jimp.read(req.file.buffer);
  await photo.resize(800, jimp.AUTO);
  await photo.write(`./public/uploads/${req.body.photo}`);
  next();
};

exports.createStore = async (req, res, next) => {
  req.body.author = req.user._id;
  const store = await new Store(req.body).save();
  req.flash(
    "success",
    `Sucsesfully created ${store.name}. Care to leave a review?`
  );
  res.redirect(`/store/${store.slug}`);
};

exports.updateStore = async (req, res, next) => {
  req.body.location.type = "Point";
  const store = await Store.findOneAndUpdate({ _id: req.params.id }, req.body, {
    new: true,
    runValidators: true
  }).exec();
  req.flash(
    "succsess",
    `sucsesfully updated <strong>${store.name}</strong>. <a href="/stores/${
      store.slug
    }">View Store</a>`
  );
  res.redirect("/");
};

exports.getStores = async (req, res) => {
  const page = req.params.page || 1;
  const limit = 6;
  const skip = page * limit - limit;
  const storesPromise = Store.find()
    .skip(skip)
    .limit(limit)
    .sort({ created: "desc" });
  const countPromise = Store.count();
  const [stores, count] = await Promise.all([storesPromise, countPromise]);
  const pages = Math.ceil(count / limit);
  if (!stores.length && skip) {
    req.flash(
      "info",
      `Hey! You asked for page ${page}. But that dosen't exist so I put you on page ${pages}`
    );
    res.redirect(`/stores/page/${pages}`);
    return;
  }
  res.render("stores", { title: "Stores", stores, pages, count, page });
};

exports.getStore = async (req, res, next) => {
  const store = await Store.findOne({ slug: req.params.store }).populate(
    "author reviews"
  );
  if (!store) return next();
  res.render("store", { store, title: store.name });
};

const confirmOwner = (store, user) => {
  if (!store.author.equals(user._id)) {
    throw Error("You must own a store in order to edit it!");
  }
};
exports.editStore = async (req, res, next) => {
  const store = await Store.findOne({ _id: req.params.id });
  confirmOwner(store, req.user);
  res.render("editStore", { title: `Edit ${store.name}`, store });
};

exports.getStoresByTags = async (req, res, next) => {
  const tag = req.params.tag;
  const tagQuery = tag || { $exists: true };
  const tagsPromise = Store.getTagsList();
  const storePromise = Store.find({ tags: tagQuery });
  const [tags, stores] = await Promise.all([tagsPromise, storePromise]);
  res.render("tags", { stores, tags, tag, title: "Tags" });
};

exports.searchStores = async (req, res, next) => {
  const stores = await Store
    // Finst stores
    .find(
      {
        $text: {
          $search: req.query.q
        }
      },
      {
        score: { $meta: "textScore" }
      }
    )
    // sort them
    .sort({ score: { $meta: "textScore" } })
    // limit them
    .limit(5);
  res.json(stores);
};

exports.mapStores = async (req, res, next) => {
  const coordinates = [req.query.lng, req.query.lat].map(parseFloat);
  const q = {
    location: {
      $near: {
        $geometry: {
          type: "Point",
          coordinates
        },
        $maxDistance: 10000
      }
    }
  };

  const stores = await Store.find(q)
    .select("slug name description location photo")
    .limit(10);
  res.json(stores);
};

exports.mapPage = (req, res, next) => {
  res.render("map", { title: "map" });
};

exports.heartStore = async (req, res, next) => {
  const hearts = req.user.hearts.map(obj => obj.toString());
  const operator = hearts.includes(req.params.id) ? "$pull" : "$addToSet";
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { [operator]: { hearts: req.params.id } },
    { new: true }
  );
  res.json(user);
};

exports.heartPage = async (req, res, next) => {
  const hearts = await Store.find({ _id: req.user.hearts });
  res.render("heart", { title: "Hearted", hearts });
};

exports.getTopStores = async (req, res, next) => {
  const stores = await Store.getTopStores();
  res.render("topStores", { stores, title: "Top Stores!" });
};
