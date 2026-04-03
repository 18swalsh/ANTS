-- Double-click in Script Editor, then press the Run (▶) button.
-- This builds the Mac ZIP without using Terminal.

on run
  set projectPath to POSIX path of (path to me)
  set projectPath to do shell script "dirname " & quoted form of projectPath
  try
    do shell script "cd " & quoted form of projectPath & " && /bin/bash ./build-mac.command >/dev/null 2>&1"
  on error
    -- build-mac.command shows its own dialogs; suppress Script Editor errors
  end try
end run
