# RunAround

A website of Virtual Running Races in Townsville, North Queensland, Australia and their leaderboards.

# 1 Environment Variables

Set the environment variables
or run `STRAVA_EMAIL=anygis0000+1@gmail.com STRAVA_PASSWORD=AnyG15server STRAVA_ACCESS_TOKEN=a84fec0774ed062bcaed9b581ad36ccd38979465 STRAVA_CLIENT_ID=54973 STRAVA_CLIENT_SECRET=6c4ce997f71a1f56991f6dea667370d14af4dbe5 STRAVA_REDIRECT_URI=localhost node build`

# 2 Build Database

Then the database can be built by running build.js

# 3 Start ExpressJS server

Now the server can be start (index.js)

# Notes

Use pm2 and nginx server.
Setup cron (update.sh).

old:

0 0 1 \* \* node /var/www/runaround/build.js >/dev/null 2>&1
