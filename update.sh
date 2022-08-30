#!/bin/bash

echo "Updating RunAround"
echo "git pull"
git pull
echo "git commit"
git commit -a -m "database"
echo "git push"
git push
echo "node build"
node build
echo "pm2 restart"
pm2 restart "runaround" 
echo "Done Updating RunAround"
