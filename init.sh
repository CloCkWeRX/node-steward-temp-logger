#! /bin/sh
### BEGIN INIT INFO
# Provides:          steward-temp-logger
# Required-Start:    $all
# Required-Stop:     $remote_fs $syslog
# Default-Start:     2 3 4 5
# Default-Stop:      0 1 6
# Short-Description: Manages the Things System, Inc., steward daemon
# Description:       Manages the Things System, Inc., steward daemon
### END INIT INFO

# Author: Daniel O'Connor <daniel.oconnor@gmail.com>
#
# Please remove the "Author" lines above and replace them
# with your own name if you copy and modify this script.

# Do NOT "set -e"

# PATH should only include /usr/* if it runs after the mountnfs.sh script
PATH=/sbin:/usr/sbin:/bin:/usr/bin:/usr/local/bin

STEWARD=/usr/local/bin/node
STEW_PID=/var/run/steward-temp-logger.pid
STEW_ARGS="/home/pi/node-steward-temp-logger/monitor.js"
STEW_FILE="/var/log/steward-temp-logger.log"
PID=

case "$1" in
start) 
   echo -n "Start steward-temp-logger services... "
   $STEWARD $STEW_ARGS >> $STEW_FILE 2>&1 &
   PID=$!
   echo "pid is $PID"
   echo $PID >> $STEW_PID
   ;;
stop)   echo -n "Stop steward-temp-logger services..."
   echo -n "killing "
   echo -n `cat $STEW_PID`
   kill `cat $STEW_PID`
   rm $STEW_PID
   echo -n " "
   ;;
restart)
   $0 stop
   $0 start
        ;;
*)   echo "Usage: $0 (start|stop)"
        exit 1
        ;;
esac
exit 0
