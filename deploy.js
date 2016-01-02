
var childProcess = require('child_process')

childProcess.execSync('git add .')
childProcess.execSync('git commit -m "Deploy"')
childProcess.execSync('git push origin master')

childProcess.execSync('ssh noah@noahthomas.us < deploy.sh')
