#!/bin/bash

set -e

source .env.sh || echo 'no .env.sh file found'

target=$1
host=$DEPLOY_HOST
port=$DEPLOY_PORT
skip_build=${SKIP_BUILD}

if [ "$target" == 'dev' ]; then
  app_dir=/root/apps/notepad_dev
  start_cmd="pm2 startOrRestart pm2_dev.json"
elif [ "$target" = 'prod' ]; then
  app_dir=/root/apps/notepad
  start_cmd="pm2 startOrRestart pm2_prod.json"
else
  echo 'unknown target'
  exit 1
fi

echo "deploying: $target"

if [[ $skip_build == '1' ]]; then
  echo 'skipping build'
else
  pnpm install
  pnpm run type
  pnpm run test --run
  pnpm run build
fi

rsync --exclude-from=.rsyncignore -avz ./ "$host":$app_dir/

ssh "$host" -p"$port" <<EOF
  set -e

  cd $app_dir

  pnpm install
  # pnpm build
  $start_cmd

  echo 'deploy done'
EOF
