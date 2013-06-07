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
################################################################################
set -e
# Helper function - this will prepare the config file for use by PZH
prepare_pzp_config(){
  config_backup_file=$1".bak"
  cp -f $1 $config_backup_file
  sed -i 's/\(\s*"provider"\s*:\)\s*[0-9]*,/\16080,/' $1
  sed -i 's/\(\s*"provider_webServer"\s*:\s*\)[0-9]*,/\16443,/' $1
  echo "webinos_config changed: "
  head $1
}
prepare_pzh_config(){
  config_backup_file=$1".bak"
  cp -f $1 $config_backup_file
  sed -i 's/\(\s*"provider"\s*:\)\s*[0-9]*,/\16080,/' $1
  sed -i 's/\(\s*"provider_webServer"\s*:\s*\)[0-9]*/\16443/' $1
  echo "webinos_config changed: "
  head $1
}

export CUR_DIR=`pwd`
export WEBINOS_PZH_DATA=$HOME/'.webinosPzh'
export WEBINOS_PZH_DIR=$CUR_DIR/'node_modules'/'webinos-pzh'
export WEBINOS_PZP_DATA=$HOME/'.webinos'


# Empty it, and check out the PZP
if [ -d "$WEBINOS_PZH_DATA" ]; then
  rm -rf $WEBINOS_PZH_DATA
  echo "Deleted directory $WEBINOS_PZH_DATA"
fi

#if [ ! -d $WEBINOS_PZH_DIR ]; then
  rm -rf $WEBINOS_PZH_DIR
  npm install git://github.com/webinos/webinos-pzh.git
  echo "Installed the PZH and its dependencies"
#fi

cd $WEBINOS_PZH_DIR
prepare_pzh_config "config.json"
node ./'webinos_pzh.js' &
sleep 2
echo "Started the PZH and waited"

# Empty it, and check out the PZP
if [ -d "$WEBINOS_PZP_DATA" ]; then
  rm -rf $WEBINOS_PZP_DATA
  echo "Deleted directory $WEBINOS_PZP_DATA"
fi

cd $CUR_DIR
prepare_pzp_config "config.json"
jasmine-node test/jasmine/ --verbose --forceexit

killall node
