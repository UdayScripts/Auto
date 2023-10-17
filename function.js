const fs = require('fs')
const axios = require('axios')
const path = require('path')

//Importing bot intance from bot.js
let bot = require('./bot')

//Sleep function to wait for seconds
exports.sleep = (in_sec) => {
  return new Promise(resolve => setTimeout(resolve, in_sec * 1000));
}

//Unban kicked users function
exports.unban_all = async (chat_id, ctx) => {
  let result = JSON.parse(fs.readFileSync(__dirname + '/db/channels/' + chat_id + '/data.json'))
  await ctx.answerCbQuery('Unbanning Started...')
  let all_users = result.kicked
  const promises = all_users.map(async id => {
    bot.telegram.unbanChatMember(chat_id, id).catch((err) => {
      console.log(err)
    })
    all_users.length -= 1
  })
  Promise.all(promises).then(() => {
    result.kicked = []
    fs.writeFileSync(__dirname + '/db/channels/' + chat_id + '/data.json', JSON.stringify(result))
  })
  return true
}

// Checking if channel have enough kicks to kick users and this function cut kicks from channel
exports.check_if_can_kick = async (ctx) => {
  let chat_id = ctx.update.chat_member.chat.id
  let chat_name = ctx.update.chat_member.chat.username
  let c_data = JSON.parse(fs.readFileSync(__dirname + '/db/channels/' + chat_id + '/data.json'))
  let pending_kick = c_data.pending_kick || []
  let can_kick = c_data.can_kick || 0
  if (can_kick < 1) {
    bot.telegram.sendMessage(c_data.owner, '<b>Your Channel: @' + chat_name + ' is Removed From Bot Because You Dont Have Kicks, Add Kicks With /my_account Command</b>', {
      parse_mode: 'HTML'
    }).catch(err => {
      console.log(err)
    })
    pending_kick.push(ctx.update.chat_member.new_chat_member.user.id)
    c_data.pending_kick = pending_kick
    if (!(c_data.removed)) {
      c_data.removed = true
      fs.writeFileSync(__dirname + '/db/channels/' + chat_id + '/data.json', JSON.stringify(c_data))
    }
    return false
  }
  let kicked = c_data.kicked || []
  kicked.push(ctx.update.chat_member.new_chat_member.user.id)
  c_data.kicked = kicked
  c_data.can_kick = can_kick - 1
  fs.writeFileSync(__dirname + '/db/channels/' + chat_id + '/data.json', JSON.stringify(c_data))
  return true
}


exports.broadcast_running = false
exports.broadcast_function = async (ctx) => {
  broadcast_running = true
  let markup = {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [[{
        text: 'Stop Broadcast',
        callback_data: 'stop_broadcast'
      }]]
    }
  }
  let hmsg = await ctx.replyWithHTML('<b>Starting broadcast...</b>', markup)
  let users_done = 0
  let all_users = this.getDirectories(__dirname + '/db/users')
  let users_left = all_users.length
  for (i in all_users) {
    let id = all_users[i]
    if (!broadcast_running) {
      break
    }
    if (users_done == 5) {
      ctx.tg.editMessageText(ctx.from.id, hmsg.message_id, null, '<b>Sleeping for 5 seconds</b>', markup).catch((err) => {
        console.log(err)
      })
      await this.sleep(5)
      users_done -= users_done
    }
    users_done += 1
    users_left -= 1
    if (ctx.update.message.forward_date) {
      ctx.forwardMessage(id).catch((err) => {
        console.log(err)
      })
    } else {
      ctx.copyMessage(id).catch((err) => {
        console.log(err)
      })
    }
    await ctx.tg.editMessageText(ctx.from.id, hmsg.message_id, null, '<b>Users Left : ' + users_left + '</b>', markup).catch((err) => {
      console.log(err)
    })
  }
  await ctx.tg.editMessageText(ctx.from.id, hmsg.message_id, null, '<b><u>Broadcast Completed...</u></b>', {
    parse_mode: 'HTML'
  }).catch((err) => {
    console.log(err)
  })
}

exports.removeItemFromArray = (arr, value) => {
  var i = 0;
  while (i < arr.length) {
    if (arr[i] === value) {
      arr.splice(i, 1);
    } else {
      ++i;
    }
  }
  return arr;
}

exports.getDirectories = (path) => {
  return fs.readdirSync(path).filter(function (file) {
    return fs.statSync(path + '/' + file).isDirectory();
  });
}

exports.removeDublicate = (array) => {
  return [...new Set(array)];
}

exports.makeid = (length) => {
  var result = '';
  var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() *
      charactersLength));
  }
  return 'AUTOKICKER' + result
}


//returing an array of channels added by a specied user
exports.get_user_channels = (user_id) => {
  if (!user_id) {
    throw new Error('Must Provide User Id to Use get_user_channels Function')
  }
  let channels_by_user = []
  let all_channels = this.getDirectories(path.join(__dirname, 'db', 'channels'))
  for (i in all_channels) {
    let chat_id = all_channels[i]
    if (fs.existsSync(path.join(__dirname, 'db', 'channels', chat_id, 'data.json'))) {
      let chat_data = JSON.parse(fs.readFileSync(path.join(__dirname, 'db', 'channels', chat_id, 'data.json')))
      if (parseInt(chat_data.owner) == parseInt(user_id)) {
        chat_data.chat_id = chat_id
        channels_by_user.push(chat_data)
      }
    }
  }
  return channels_by_user
}

exports.paginate = function (arr, size) {
  size = size || 2
  return arr.reduce((acc, val, i) => {
    let idx = Math.floor(i / size);
    let page = acc[idx] || (acc[idx] = []);
    page.push(val);
    return acc;
  }, []);
};

//Ban all pending users and cut kicks
exports.ban_pending_users = async (chat_id) => {
  let c_data = JSON.parse(fs.readFileSync(__dirname + '/db/channels/' + chat_id + '/data.json'))
  let can_kick = c_data.can_kick || 0
  let pending_kick = c_data.pending_kick || []
  if (!(can_kick > pending_kick.length)) {
    let kicked = c_data.kicked || []
    for (i in pending_kick) {
      let id = pending_kick[i]
      c_data.kicked.push(id)
      can_kick -= 1
      await bot.telegram.kickChatMember(chat_id, id).catch(e => console.log(e))
      kicked.push(id)
    }
    c_data.kicked = kicked
    c_data.pending_kick = []
  }
  c_data.can_kick = can_kick
  fs.writeFileSync(__dirname + '/db/channels/' + chat_id + '/data.json', JSON.stringify(c_data))
  return true
}