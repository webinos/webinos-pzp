#! /bin/bash
################################################################################
#  Code contributed to the webinos project
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
# Copyright 2013 John Lyle, University of Oxford
################################################################################

# To be run from the root directory of the PZP module

# Fail if anything fails
set -e

export PZP_DIR=`pwd`
export TESTDIR=$PZP_DIR/test/policy
export WEBINOSJS=$PZP_DIR/web_root/webinos.js
export WEBINOSJSCP=$TESTDIR/webinos.js

# copy the webinos.js file into this directory
if [ -e "$WEBINOSJSCP" ]; then
  rm $WEBINOSJSCP
  echo "Deleted file $WEBINOSJSCP"
fi
echo "copying webinos.js"
cp -v $WEBINOSJS $WEBINOSJSCP

sleep 2

# run the PZP in test mode, to creat initial directories
node ./webinos_pzp.js --test
sleep 2

# Remove the policy file
if [ -e "~/.webinos/policies/policy.xml" ]; then
  echo "remove policy.xml"
  rm ~/.webinos/policies/policy.xml
fi

# upload a deny-all policy
echo "Setting a deny-all policy"
cp $TESTDIR/deny-all.xml ~/.webinos/policies/policy.xml

# start the PZP
echo "Starting the PZP"
node ./webinos_pzp.js &

export PZP_PID=$!

# wait 5 secs for it to start
sleep 5
echo "Started the PZP and waited" 

set +e

# run the node test script
# note that we're in the webinos-pzh directory at the moment.
node $TESTDIR/zombietest.deny.spec.js

export TEST_RESULT=$?

echo "Killing the PZP"
# Kill the PZP
kill -9 $PZP_PID

if [ $TEST_RESULT -eq 0 ]; then
  echo "TEST PASSED"
else 
  echo "TEST FAILED"
fi

exit $TEST_RESULT