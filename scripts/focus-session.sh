#!/bin/bash
# Called by terminal-notifier on notification click.
# $1 = "url:<full-url>"  → open that URL directly
# $1 = "ide"             → activate PyCharm

case "$1" in
  url:*)
    open "${1#url:}"
    ;;
  ide)
    osascript -e 'tell application "PyCharm" to activate'
    ;;
esac
