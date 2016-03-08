cd /usr/PiggyBack
cat password | sudo -S git pull
pm2 restart PiggyBack
pm2 restart Test
