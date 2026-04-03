-- Double-click in Script Editor, then press the Run (▶) button.
-- This builds the Mac ZIP without using Terminal.

on run
  set projectPath to POSIX path of (path to me)
  set projectPath to do shell script "dirname " & quoted form of projectPath
  do shell script "cd " & quoted form of projectPath & " && /bin/bash ./build-mac.command"
end run
