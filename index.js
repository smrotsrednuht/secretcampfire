const bodyParser = require('body-parser')
const cors = require('cors')
const cel = require('connect-ensure-login')
const express = require('express')
const http = require('http')
const md5 = require('md5');
const path = require('path')
const passport = require('passport')
const LocalStrategy = require('passport-local').Strategy
const session = require('express-session')
const db = require('./db')
const consts = require('./consts')
const cron = require('./cron')

const PORT = process.env.PORT || 5000

/* 
 * setup passport for auth
 */

passport.use(new LocalStrategy(function(username, password, cb) {
  db.getSettings(function(err, settings) {
    if (err) { return cb(err); }
    if (!settings) { return cb(null, false); }
    if (settings.password != md5(password)) { return cb(null, false); }
    return cb(null, settings);
  });
}));

passport.serializeUser(function(user, cb) {
  cb(null, user.id);
});

passport.deserializeUser(function(id, cb) {
  db.getSettings(function(err, user) {
    if (err) { return cb(err); }
    cb(null, user);
  });
});

/*
 * setup app
 */

var app = express();

app.locals.SITE_NAME = consts.SITE_NAME;
app.locals.SITE_EMAIL = consts.SITE_EMAIL;
app.locals.MASTER_URL = consts.MASTER_URL;
app.locals.MASTER_DOMAIN = consts.MASTER_DOMAIN;
app.locals.MASTER_FEED = consts.MASTER_FEED;
app.locals.MASTER_NEWS = consts.MASTER_NEWS;
app.locals.NUM_POSTS_PER_FETCH = consts.NUM_POSTS_PER_FETCH;

app
  .use(cors())
  .options('*', cors())
  .use(express.static(path.join(__dirname, 'public')))
  .set('views', path.join(__dirname, 'views'))
  .set('view engine', 'ejs')
  .use(bodyParser.json())
  .use(bodyParser.urlencoded({ extended: true }))
  .use(session({
    secret: app.locals.SITE_NAME, resave: false, saveUninitialized: false 
  }))
  .use(passport.initialize())
  .use(passport.session())

// redirect to https if we know our environment supports it
app.use((req, res, next) => {
  if (process.env.NODE_ENV  == 'production'
    && req.headers['x-forwarded-proto'] != 'https') 
  {
    res.redirect(302, 'https://' + req.hostname + req.originalUrl);
    return;
  }

  next();
});

// handle errors
app.use((err, req, res, next) => {
  if (!err)
    return next();

  res.status(500);
  res.send('500: Internal server error');
});

function _getReqProtocol(req) {
  return req.headers['x-forwarded-proto'] || req.protocol;
}
function _getFeedUrl(req) {
  // default to own feed
  return _getReqProtocol(req) + '://' + req.headers.host + '/feed';
}
function _getQueueFeedUrl(req) {
  // default to own feed
  return _getReqProtocol(req) + '://' + req.headers.host + '/dashboard/qfeed';
}
function _render(req, res, myuri) {
  var uri = _getFeedUrl(req); // default to own feed
  if (myuri)
  {
    if (/^\d+$/.test(myuri))
    {
      // all digits = offset into own feed
      uri += "/" + myuri;
    }
    else
      uri = myuri;
  }

  res.render('pages/render', {
    'uri': uri,
    'fullscreen': req.query['fullscreen']
  });
}
function _nocache(req, res, next) {
  res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  res.header('Expires', '-1');
  res.header('Pragma', 'no-cache');
  next();
}

app.get('/', function(req, res) {
  db.getSettings(function(err, settings) {
    if (settings.password == md5("password"))
    {
      res.render('pages/index');
      return;
    }

    _render(req, res);
  });
});

function _assembleFeed(req, posts, cb) {
  db.getSettings(function(err, settings) {
    var feed = {
      'name': req.headers.host, 
      'description': '',
      'avatar_url': '',
      'header_url': '',
      'style_url': _getReqProtocol(req) 
        + '://' + req.headers.host + '/stylesheets/feed.css',
      'posts': posts,
      'blog_url': _getReqProtocol(req) + "://" + req.headers.host,
      'nsfw': false
    };

    if (settings)
    {
      feed.name = settings.name;
      feed.description = settings.description;
      feed.avatar_url = settings.avatar_url;
      feed.header_url = settings.header_url;
      if (settings.nsfw)
        feed.nsfw = true;
    }

    cb(feed);
  });
}

app.get('/feed/:index?', _nocache, function (req, res) {
  var index = req.params['index'];
  index = (index)? parseInt(index) : 0;

  var numToFetch = app.locals.NUM_POSTS_PER_FETCH;
  if (req.query['n'])
    numToFetch = parseInt(req.query['n']);

  filter = {};
  if (req.query['tag'])
    filter['tags'] = req.query['tag'];

  // send a page from DB
  db.fetchPosts(index, numToFetch, filter, function(err, posts) {
    _assembleFeed(req, posts, function(feed) {
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify(feed, null, 2));
    });
  });

  if (index == 0)
    db.addFollower(req.headers.referer);
});

app.get('/follow/check/:uri?', function (req, res) {
	var uri = req.params['uri'];
  db.isFollowing(uri, function(err, doc) {
    isFollowing = (doc)? true : false;
    ret = {
      'is_following': isFollowing
    }
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(ret, null, 2));
  });
});

app.get('/followers/count', function (req, res) {
  db.getFollowersCount(function(err, num) {
    ret = {
      'n': num
    }
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(ret, null, 2));
  });
});

app.get('/followers/:index?', function (req, res) {
	var index = req.params['index'];
  index = (index)? parseInt(index) : 0;

  db.getFollowers(index, 100, function(err, followers) {
    res.setHeader('Content-Type', 'application/json');
    ret = {
      'followers': followers
    }
    res.send(JSON.stringify(ret, null, 2));
  });
});

app.get('/following/count', function (req, res) {
  db.getFollowingCount(function(err, num) {
    ret = {
      'n': num
    }
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(ret, null, 2));
  });
});

app.get('/following/:index?', function (req, res) {
	var index = req.params['index'];
  index = (index)? parseInt(index) : 0;

  db.getFollowing(index, 100, function(err, follows) {
    res.setHeader('Content-Type', 'application/json');
    ret = {
      'following': follows
    }
    res.send(JSON.stringify(ret, null, 2));
  });
});

app.get('/is_owner', function (req, res) {
  var isOwner = false;
  if (req.user)
    isOwner = true;

  ret = {
    'is_owner': isOwner
  };

  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(ret, null, 2));
});


app.get('/login', function(req, res) {
  res.render('pages/login', {
    'uri': _getFeedUrl(req)
  });
});

app.post('/login', passport.authenticate('local', { 
  successReturnToOrRedirect: '/dashboard',
  failureRedirect: '/login?error=1' 
}));

app.get('/logout', function(req, res) {
  req.logout();
  res.redirect('/');
});

app.get('/post/sources/count', function (req, res) {
  db.getPostSourcesCount(function(err, num) {
    ret = {
      'n': num
    }
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(ret, null, 2));
  });
});

app.get('/post/sources/:index?', function (req, res) {
	var index = req.params['index'];
  index = (index)? parseInt(index) : 0;

  db.getPostSources(index, 100, function(err, sources) {
    res.setHeader('Content-Type', 'application/json');
    ret = {
      'sources': sources
    }
    res.send(JSON.stringify(ret, null, 2));
  });
});

app.get('/post/count', function (req, res) {
  db.getPostCount(function(err, num) {
    ret = {
      'n': num
    }
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(ret, null, 2));
  });
});

app.get('/post/:id', function (req, res) {
  res.setHeader('Content-Type', 'application/json');
  db.getSettings(function(err, settings) {
    db.getPost(req.params['id'], function(err, post) {
      if (!post)
      {
        res.status(404).send("{}");
        return;
      }

      var ret = {
        'name': req.headers.host, 
        'description': '',
        'avatar_url': '',
        'header_url': '',
        'style_url': _getReqProtocol(req) 
          + '://' + req.headers.host + '/stylesheets/feed.css',
        'post': post,
        'blog_url': _getReqProtocol(req) + "://" + req.headers.host
      };

      if (settings)
      {
        ret.name = settings.name;
        ret.description = settings.description;
        ret.avatar_url = settings.avatar_url;
        ret.header_url = settings.header_url;
      }

      res.send(JSON.stringify(ret, null, 2));
    });
  });
});

app.get('/render/:uri?', function (req, res) {
  _render(req, res, req.params['uri']);
});

app.get('/tag/:tag/:index?', function (req, res) {
  var index = req.params['index'];
  index = (index)? parseInt(index) : 0;

  uri = _getFeedUrl(req) 
    + "/" + index
    + "?tag=" + req.params['tag'];

  _render(req, res, uri);
});

// catch-all route
app.get('*', function (req, res, next) {
  if (req.url.indexOf("/dashboard") != -1
    || req.url.indexOf("/settings") != -1
    || req.url.indexOf("/follow") != -1
    || req.url.indexOf("/logout") != -1)
    return next();

  res.send("");
});

/*
 * protected routes below
 */

function _cronActivatePostQueue(interval) {
  console.log("[cron] auto-posting from queue every " 
    + interval + " minute(s)");

  cron.addTask("post_from_queue", interval, function() {
    db.fetchQueuedPosts(0, 1, {}, function(err, posts) {
      if (!posts || posts.length == 0)
        return;
      var post = posts[0];
      post.queued = false;
      post.date = Date.now();
      post.save();
    });
  });
}
function _cronDeactivatePostQueue() {
  console.log("[cron] auto-post queue disabled");
  cron.delTask("post_from_queue");
}

app.post('/post', cel.ensureLoggedIn(), function(req, res) {
  db.post(req.body, function(err, newPost) {
    res.status(200).json(newPost);
  });
});

app.post('/post/delete', cel.ensureLoggedIn(), function (req, res) {
  db.delPost(req.body.id, function(err) {
    res.status(200).json({'status': err});
  });
});

app.post('/post/now', cel.ensureLoggedIn(), function (req, res) {
  db.postNow(req.body.id, function(err, post) {
    res.status(200).json(post);
  });
});

app.get('/dashboard/posts/:index?', cel.ensureLoggedIn(), function (req, res) {
	var index = req.params['index'];
  index = (index)? parseInt(index) : 0;

  res.render('pages/dashboard', {
    'uri': _getFeedUrl(req),
    'render_uris': [
      _getFeedUrl(req) + "/" + index
    ]
  });
});

app.get('/dashboard/qfeed/:index?', 
  [_nocache, cel.ensureLoggedIn()], function (req, res) {
  var index = req.params['index'];
  index = (index)? parseInt(index) : 0;

  // send a page from DB
  var numToFetch = app.locals.NUM_POSTS_PER_FETCH;
  db.fetchQueuedPosts(index, numToFetch, {}, function(err, posts) {
    _assembleFeed(req, posts, function(feed) {
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify(feed, null, 2));
    });
  });
});

app.get('/dashboard/queue/count', cel.ensureLoggedIn(), function (req, res) {
  db.getQueuedCount(function(err, num) {
    ret = {
      'n': num
    }
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(ret, null, 2));
  });
});

app.get('/dashboard/queue/:index?', cel.ensureLoggedIn(), function (req, res) {
	var index = req.params['index'];
  index = (index)? parseInt(index) : 0;

  res.render('pages/dashboard', {
    'uri': _getQueueFeedUrl(req),
    'render_uris': [
      _getQueueFeedUrl(req) + "/" + index
    ]
  });
});

app.get('/dashboard/:start_offset?', cel.ensureLoggedIn(), function(req, res) {
	var startOffset = req.params['start_offset'];
  startOffset = (startOffset)? parseInt(startOffset) : 0;

  db.getRandomFollowing(function(err, follows) {
    followUris = []
    for (var i=0; i < follows.length; i++)
      followUris.push(follows[i].url + "/" + startOffset);

    res.render('pages/dashboard', {
      'uri': _getFeedUrl(req),
      'render_uris': followUris
    });
  });
});

app.get('/settings', cel.ensureLoggedIn(), function (req, res) {
  db.getSettings(function(err, settings) {
    if (req.query['json'])
    {
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify(settings, null, 2));
      return;
    }

    res.render('pages/settings', {
      'uri': _getFeedUrl(req),
      'settings': settings
    });
  });
});

app.post('/settings', cel.ensureLoggedIn(), function(req, res) {
  db.saveSettings(req.body, function(err, settings) {
    if (settings && settings.queue_interval)
      _cronActivatePostQueue(settings.queue_interval);
    else
      _cronDeactivatePostQueue();

    res.status(200).json(settings);
  });
});

app.post('/follow', cel.ensureLoggedIn(), function(req, res) {
  var url = req.body.url;
  // TODO verify that 'url' points to valid feed
  
  db.follow(req.body.url, function(err, newFollow) {
    res.status(200).json(newFollow);
  });
});

app.post('/unfollow', cel.ensureLoggedIn(), function(req, res) {
  var url = req.body.url;

  db.unfollow(url, function(err) {
    res.status(200).json({ });
  });
});

/*
 * add cron tasks
 */
db.getSettings(function(err, settings) {
  if (settings.queue_interval)
    _cronActivatePostQueue(settings.queue_interval);
});

app.listen(PORT, () => console.log(`Listening on ${ PORT }`));
