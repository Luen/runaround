# RunAround

A website of Virtual Running Races in Townsville, North Queensland, Australia and their leaderboards.

# 1 Install
`npm i`

# 2 Build Database

Then the database can be built by running build.js

`node build`
or
`node build all` to start afresh

# 3 Start ExpressJS server

Now the server can be start (index.js)
`node index.js`
or
`pm2 start index.js --name runaround`

# Notes

Use pm2 and nginx server.
Setup cron (update.sh).

old:
0 0 1 \* \* node /var/www/runaround/build.js >/dev/null 2>&1
