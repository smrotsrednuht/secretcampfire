## How to unlock image file uploads

To unlock image file uploads on `secret campfire` via Imgur, you'll need to provide your own Imgur key. This is so that `secret campfire` is authorized to upload files to Imgur on your behalf. Imgur will host your images for free and your blog will point to Imgur for images.

To start, visit this page to *Register an Application*: https://api.imgur.com/oauth2/addclient 

Under *Authorization type*, make sure to select *Anonymous usage without user authentication*. Leave *Authorization callback URL* empty. You may enter anything you want in the remaining fields. Click *submit*.

On the next page, you'll find your `Client ID` and your `Client secret`. Save both for your records, but what `secret campfire` needs is the `Client ID`. 

Go to your blog's `Settings` page. Click `advanced settings` at the bottom. Enter your Imgur `Client ID` and save.

Once you do this, image file upload buttons will be unlocked throughout your blog.

--- 

## How to unlock Queued Posting

The `Queue` helps keep your blog active by staggering posts over a period of hours or days. You can store an unlimited number of posts in your `Queue`.

To unlock this feature, go to your blog's `Settings` page. Click `advanced settings` at the bottom. Enter a number in the `Auto-publish queued posts` box. This number tells your blog how often (in minutes) to auto-post from your queue. E.g., if you enter `60` in the box, that tells your blog to post from your `Queue` every 60 minutes. 

Once you do this, you will see an arrow button appear next to your `Post` button. To add a post to your `Queue`, click this arrow and choose `Add to queue` from the menu. Then click `Queue`.

*Warning: activating your `Queue` may prevent your blog from sleeping. This will eat up your free hosting hours faster. [See here](FAQ.md#why-does-my-blog-go-to-sleep-after-a-while-and-why-does-it-take-a-long-time-to-start-back-up-again) for more details.*

--- 

## How to set up without a credit card

Two things will make Heroku prompt you for your credit card, even though everything is 100% free:

1. to add the `mLab MongoDB` database
2. to boost your monthly free quota from 550 hours to 1000 hours

These extra features are free and your card will not be charged, but Heroku just wants to use them as an excuse to get your card on file.

If you are opposed to this, you can still use `secret campfire` without a credit card by setting up your `mLab MongoDB` database manually:

1. Instead of getting `mLab MongoDB` from Heroku, go directly to the `MongoDB` website: https://www.mongodb.com/cloud/atlas
2. Make a new `MongoDB Atlas` account.
3. At the bottom of the `Create New Cluster` page, confirm that it says `FREE` and click `Create Cluster`. 
4. On the next page, you'll see a message saying `Your cluster is being created`. Find the `Get Started` checklist on the page and click `Create your first database user`. Follow the instructions. Enter any `username` and `password` and click `Add User`.
5. Back at the `Get Started` checklist, click `Whitelist your IP address`. Follow the instructions. Click `ALLOW ACCESS FROM ANYWHERE` and click `Confirm`. 
6. Back at the `Get Started` checklist, click `Connect to your cluster`. Click the `CONNECT` button. Choose `Connect your Application`. In section 1 `Choose your driver version` select the `Node.js` driver and version `2.2.12 or later`. Click the `Copy` button to copy the connection string. It looks like: `mongodb://<your_username>:<your_password>@cluster0-shard-00-00-jyzki.mongodb.net:27017,cluster0-shard-00-01-jfzki.mongodb.net:27017,cluster0-shard-00-02-jyzki.mongodb.net:27017/test?ssl=true&replicaSet=Cluster0-shard-0&authSource=admin&retryWrites=true`. Save this for the next step.

Next, we will tell your Heroku app to use this database you just created:

1. Sign in to https://dashboard.heroku.com
2. Go to your blog/app and click `Settings`
3. Click `Reveal Config Vars`
4. Enter `MONGODB_URI` into the left box. In the right box, paste the database URI connection string from Step 6. above that looks like `mongodb://<your_username>:<your_password>@cluster0-shard-00-00-jyzki.mongodb.net:27017,cluster0-shard-00-01-jfzki.mongodb.net:27017,cluster0-shard-00-02-jyzki.mongodb.net:27017/test?ssl=true&replicaSet=Cluster0-shard-0&authSource=admin&retryWrites=true`. Replace `<your_username>` and `<your_password>` with the `username` and `password` you used in Step 4. above.

You're all set! Only catch is without a credit card on Heroku, your free quota remains at 550 hours per month -- not enough to run your blog 24/7. It'll go to sleep whenever it's idle for 30 minutes and it takes a couple of seconds to wake up whenever you get visitors.

--- 

## How to upgrade your `secret campfire` to the latest official version

When you clicked Deploy, a `snapshot` of the official master code wooshed to your server and got installed. 

As time goes by, the master code will get updated. New features will be added and bugs will be fixed. But, your server does not automatically get updated. It stays on your older `snapshot`. This is so that your blog is stable and doesn't change unless you say so.

To upgrade your blog to the latest master code, please see [UPGRADING](UPGRADING.md). Upgrading does not touch any data you have stored your database. Your data is kept safe and unmolested.
