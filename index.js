const domain = "bot.udayscripts.xyz";
const app_name = "Autokicker_x_bot";
const merchant_key = "OAtfrh85622279206450";
const admin = 1489381549; // Convert this to an integer if needed
const { Telegraf, session, Scenes, Markup, Input } = require("telegraf");
const axios = require("axios");
const { WizardScene, Stage } = Scenes;
const { enter, leave } = Stage;
const fs = require("fs");
var path = require("path");

//Import all importent function from function.js
var {
  sleep,
  unban_all,
  check_if_can_kick,
  broadcast_function,
  broadcast_running,
  removeDublicate,
  removeItemFromArray,
  getDirectories,
  makeid,
  get_user_channels,
  paginate,
  ban_pending_users,
} = require("./function");

//Importing bot intance from bot.js
let bot = require("./bot");

//Setting up our database
if (!fs.existsSync(__dirname + "/db")) {
  fs.mkdirSync(__dirname + "/db");
  fs.mkdirSync(__dirname + "/db/users");
  fs.mkdirSync(__dirname + "/db/channels");
  fs.mkdirSync(__dirname + "/db/order_id");
  fs.writeFileSync(__dirname + "/db/order_id/data.json", JSON.stringify({}));
}

//Broadcast Scene
const broadcast = new WizardScene(
  "broadcast",
  (ctx) => {
    ctx.replyWithHTML("<b>Send Post or Forward You Want to broadcast</b>");
    ctx.wizard.next();
  },
  (ctx) => {
    ctx.scene.leave();
    broadcast_function(ctx);
  }
);

//Stage of Registed Scenes
const stage = new Stage([broadcast]);

//Running bot some allowed updates
console.log("Bot Enabled");
bot.launch({
  allowedUpdates: [
    "update_id",
    "message",
    "edited_message",
    "channel_post",
    "edited_channel_post",
    "inline_query",
    "chosen_inline_result",
    "callback_query",
    "shipping_query",
    "pre_checkout_query",
    "poll",
    "poll_answer",
    "my_chat_member",
    "chat_member",
    "chat_join_request",
  ],
  dropPendingUpdates: false,
});

//Sending alert to admin
bot.telegram
  .sendMessage(admin, "I Am Restarted Please Check Me Now /start")
  .catch((err) => console.log(err));

//Bot using session to store temporary data
bot.use(session());

//Activating all scenes
bot.use(stage.middleware());

// "/help" command
bot.help((ctx) => {
  if (ctx.chat.type != "private") {
    return;
  }
  ctx
    .replyWithHTML(
      '<b>Commands\n\n1. /my_account : This Command is Used to Get Information About Your Account\n2. /status : This Command is Used to Get Information About Total Users and Total Registered Channels in This Bot\n\nHow to Add Channel in Bot ?\nAnswer : Promote This Bot in Your Channel With All Permissions\n\n<a href="https://t.me/UdayScripts">Join Our Channel</a> For Info/help</b>'
    )
    .catch((err) => {
      console.log(err);
    });
});

// "/start" command
bot.start((ctx) => {
  if (ctx.chat.type != "private") {
    return;
  }
  if (!fs.existsSync(__dirname + "/db/users/" + ctx.from.id + "")) {
    fs.mkdirSync(__dirname + "/db/users/" + ctx.from.id + "");
    fs.writeFileSync(
      __dirname + "/db/users/" + ctx.from.id + "/data.json",
      JSON.stringify({})
    );
    ctx
      .replyWithHTML("<b> Join Our Official Channel @UdayScripts</b>")
      .catch((err) => {
        console.log(err);
      });
  }
  ctx
    .replyWithHTML("<b>Hi " + ctx.from.first_name + "\n\nFor Help /help</b>")
    .catch((err) => {
      console.log(err);
    });
});

// "/status" command
bot.command("status", (ctx) => {
  if (ctx.chat.type != "private") {
    return;
  }
  let users = getDirectories(__dirname + "/db/users");
  let channels = getDirectories(__dirname + "/db/channels");
  ctx
    .replyWithHTML(
      "<b>Our Bot Status :\n\nChannels : " +
        channels.length +
        "\nUsers : " +
        users.length +
        "\n\nBot Made By @uday_x</b>"
    )
    .catch((err) => {
      console.log(err);
    });
});

// "/my_account" command
bot.command("my_account", async (ctx) => {
  if (ctx.chat.type != "private") {
    return;
  }
  const url = `${domain}/${app_name}?id=${ctx.from.id}`;
  let user_data = JSON.parse(
    fs.readFileSync(__dirname + "/db/users/" + ctx.from.id + "/data.json")
  );
  let balance = user_data.balance || 0;
  await ctx.replyWithHTML(
    `<b>Hello ${
      ctx.from.first_name + " " + (ctx.from.last_name ?ctx.from.last_name:'')
    } , Your Account Info\n\nBalance: ${balance.toFixed(2)} Points</b>`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Add Balance",
              callback_data: "add_balance",
            },
          ],
          [
            {
              text: "My Channels",
              callback_data: "my_channels",
            },
          ],
        ],
      },
    }
  );
});

//handle my_channels Callback query
bot.action("my_channels", async (ctx) => {
  let all_channels = get_user_channels(ctx.from.id);
  let final_channels = [];
  for (i in all_channels) {
    let chat_data = all_channels[i];
    if (!("removed" in chat_data) || !(chat_data.removed == true))
      final_channels.push(chat_data);
  }
  if (!final_channels.length) {
    return await ctx.replyWithHTML(
      "<i>You Did Not Have Any Registed Channels</i>"
    );
  }
  let markup = [];
  for (x in final_channels) {
    let chat_d = final_channels[x];
    let tg_chat = await bot.telegram.getChat(chat_d.chat_id).catch((err) => {
      return ctx.answerCbQuery(err);
    });
    if (tg_chat.username) {
      var link = "@" + tg_chat.username;
    } else {
      var link = tg_chat.title;
    }
    markup.push({
      text: `${link}`,
      callback_data: `/channel ${chat_d.chat_id}`,
    });
  }
  await ctx.editMessageText(
    `<b>Here is List Of Your Channels\n\nChoose Any Channel You Want to Manage</b>`,
    {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: paginate(markup, 2),
      },
    }
  );
});

//Handling "/channel" Callback_query
bot.action(
  [
    /^\/channel (.+)$/,
    /^\/ban_pending (.+)$/,
    /^\/add_kicks_pricing (.+)$/,
    /^\/unban_all (.+)$/,
    /^\/alert (.+)$/,
  ],
  async (ctx) => {
    let chat_id = ctx.match[1].split(" ")[0];
    let chat_data = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "db", "channels", chat_id, "data.json")
      )
    );
    let can_kick = chat_data.can_kick || 0;
    let pending = removeDublicate(chat_data.pending_kick || []);
    if (ctx.match[0].split(" ")[0] == "/alert") {
      if (chat_data.notify) {
        delete chat_data.notify;
      } else {
        chat_data.notify = true;
      }
      fs.writeFileSync(
        path.join(__dirname, "db", "channels", chat_id, "data.json"),
        JSON.stringify(chat_data)
      );
    }
    if (ctx.match[0].split(" ")[0] == "/unban_all") {
      await unban_all(chat_id, ctx);
      await sleep(5);
      await ctx.answerCbQuery("Unbanned All Users From Your Channel");
    }
    if (ctx.match[0].split(" ")[0] == "/ban_pending") {
      if (can_kick < pending.length) {
        return ctx.answerCbQuery("You Dont Have Enough Kicks");
      }
      ctx.answerCbQuery("Banning Pending Users...");
      await ban_pending_users(chat_id);
      await sleep(5);
    }
    if (ctx.match[0].split(" ")[0] == "/add_kicks_pricing") {
      let user_data = JSON.parse(
        fs.readFileSync(__dirname + "/db/users/" + ctx.from.id + "/data.json")
      );
      let balance = user_data.balance || 0;
      let price = parseInt(ctx.match[1].split(" ")[1]);
      let prices = require("./pricing");
      if (price > balance) {
        return await ctx.answerCbQuery("You Dont Have Enough Balance");
      }
      let can_kick = chat_data.can_kick || 0;
      user_data.balance = parseFloat(balance) - parseFloat(price);
      chat_data.can_kick = parseFloat(can_kick) + parseFloat(prices[price]);
      fs.writeFileSync(
        __dirname + "/db/users/" + ctx.from.id + "/data.json",
        JSON.stringify(user_data)
      );
      fs.writeFileSync(
        path.join(__dirname, "db", "channels", chat_id, "data.json"),
        JSON.stringify(chat_data)
      );
      await ctx.answerCbQuery(
        `${price} Deducted From Balance , ${prices[price]} Kicks Added`
      );
    }
    chat_data = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "db", "channels", chat_id, "data.json")
      )
    );
    let tg_chat = await bot.telegram.getChat(chat_id).catch((err) => {
      return ctx.answerCbQuery(err);
    });
    if (tg_chat.username) {
      var link = "@" + tg_chat.username;
    } else {
      var link = tg_chat.title;
    }
    let kicks = chat_data.can_kick || 0;
    let text = `<b>Here is your ${link}\n\nChat id: ${chat_id}\n\nCan Kick: ${kicks}</b>`;
    if (!tg_chat.username) {
      text += "<b>\n\nInvite Link: " + tg_chat.invite_link + "</b>";
    }
    let kicked = removeDublicate(chat_data.kicked || []);
    let markup = [
      {
        text: "Add Kicks",
        callback_data: `/add_kicks ${chat_id}`,
      },
    ];
    if (kicked.length) {
      text += `<b>\n\nBanned Users: ${kicked.length}</b>`;
      markup.push({
        text: "Unban All",
        callback_data: `/unban_all ${chat_id}`,
      });
    }
    if (pending.length) {
      text += `<b>\n\nPending Users: ${pending.length}</b>`;
      markup.push({
        text: "Ban Pending",
        callback_data: `/ban_pending ${chat_id}`,
      });
    }
    if (chat_data.notify) {
      markup.push({
        text: "Disable Alert",
        callback_data: `/alert ${chat_id}`,
      });
    } else {
      markup.push({
        text: "Activate Alert",
        callback_data: `/alert ${chat_id}`,
      });
    }
    await ctx.editMessageText(text, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: paginate(markup),
      },
    });
  }
);

//Handle "/add_kicks" Callback Query
bot.action(/^\/add_kicks (.+)$/, async (ctx) => {
  let chat_id = ctx.match[1];
  let user_data = JSON.parse(
    fs.readFileSync(__dirname + "/db/users/" + ctx.from.id + "/data.json")
  );
  let balance = user_data.balance || 0;
  let chat_data = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "db", "channels", chat_id, "data.json")
    )
  );
  let pricing = require("./pricing");
  let markup = [];
  var keys = Object.keys(pricing);
  if (chat_data.username == "undefined") {
    var link = "@" + chat_data.username;
  } else {
    var link = chat_id;
  }
  for (i in keys) {
    let p = keys[i];
    markup.push({
      text: `${p} Points = ${pricing[parseInt(p)]}`,
      callback_data: `/add_kicks_pricing ${chat_id} ${p}`,
    });
  }
  await ctx.editMessageText(
    `<b>Add Kicks in ${link} From Below Buttons\n\nYour Balance: ${balance.toFixed(
      2
    )} Points</b>`,
    {
      reply_markup: {
        inline_keyboard: paginate(markup, 2),
      },
      parse_mode: "HTML",
    }
  );
});

//web app fucks up so manual add balance system
let waiting_for_answer = {};
bot.action("add_balance", async (ctx) => {
  await ctx.deleteMessage();
  await ctx.reply(
    "<b>To Add Kicks Contact Our <a href=\"https://t.me/uday_x\">Admin</a> \n\n10Rs - 200 Kicks\n20Rs - 500 Kicks\n30Rs - 1100 Kicks\n50Rs - 1800 Kicks #Offer</b>",
    { parse_mode: "HTML", disable_web_page_preview: true } // parse_mode should be an object inside the reply function
  );
});
// "/add_points" command
bot.command("add_points", async (ctx) => {
  if (ctx.chat.type != "private") {
    return;
  }

  // Check if the user is the admin
  if (ctx.from.id !== admin) {
    return ctx.reply("Only the admin can use this command.");
  }

  const args = ctx.message.text.split(" ");
  if (args.length !== 3) {
    return ctx.reply("Usage: /add_points <user_id> <points>");
  }

  const userId = parseInt(args[1]);
  const pointsToAdd = parseFloat(args[2]);

  if (isNaN(userId) || isNaN(pointsToAdd)) {
    return ctx.reply("Invalid user ID or points.");
  }

  // Load user data
  const userFilePath = path.join(__dirname, "db", "users", `${userId}`, "data.json");
  if (!fs.existsSync(userFilePath)) {
    return ctx.reply("User not found.");
  }

  const userData = JSON.parse(fs.readFileSync(userFilePath));
  const currentBalance = userData.balance || 0;
  const newBalance = currentBalance + pointsToAdd;

  userData.balance = newBalance;
  fs.writeFileSync(userFilePath, JSON.stringify(userData));

  ctx.reply(`Added ${pointsToAdd} points to user ${userId}. New balance: ${newBalance.toFixed(2)}`);
});
//Handler for chat_member
let number = 0;
bot.on("chat_member", async (ctx) => {
  if (number == 5) {
    number -= number;
    await sleep(5);
  }
  number += 1;
  let chat_id = ctx.update.chat_member.chat.id;
  let chat_name = ctx.update.chat_member.chat.username;
  if (chat_name) {
    var link = "@" + chat_name;
  } else {
    var link = chat_id;
  }
  let folders = getDirectories(__dirname + "/db/channels");
  if (folders.includes("" + chat_id + "")) {
    let c_data = fs.readFileSync(
      __dirname + "/db/channels/" + chat_id + "/data.json"
    );
    c_data = JSON.parse(c_data);
    let status = ctx.update.chat_member.new_chat_member.status;
    let old_status = ctx.update.chat_member.old_chat_member.status;
    let user_id =
      "<a href='tg://user?id=" +
      ctx.update.chat_member.new_chat_member.user.id +
      "'>" +
      ctx.update.chat_member.new_chat_member.user.first_name +
      "</a>";
    let text;
    c_data.username = chat_name;
    if (status == "left" && old_status != "kicked") {
      let check_can_kick = await check_if_can_kick(ctx);
      if (!check_can_kick) {
        return;
      }
      await ctx
        .kickChatMember(ctx.update.chat_member.from.id)
        .catch((e) => console.log(e));
      text =
        "<b>" +
        user_id +
        " Left Channel : " +
        link +
        " \nAction : <u>Kicked</u></b>";
    } else if (status == "member" && old_status == "left") {
      text = "<b> " + user_id + " Joined Channel : " + link + "</b>";
    }
    if (!("notify" in c_data)) {
      return;
    }
    bot.telegram
      .sendMessage(c_data.owner, text, {
        parse_mode: "HTML",
      })
      .catch((err) => {});
  }
});

//when ever bot is promted or depromted in channel this will handle
bot.on("my_chat_member", async (ctx) => {
  let new_status = ctx.update.my_chat_member.new_chat_member.status;
  let chat_id = ctx.update.my_chat_member.chat.id;
  let user_id = ctx.update.my_chat_member.from.id;
  let folders = getDirectories(__dirname + "/db/channels");
  let user_name = ctx.update.my_chat_member.chat.username;
  if (user_name) {
    var link = "@" + user_name;
  } else {
    var link = chat_id;
  }
  let tg_chat = await bot.telegram.getChat(chat_id).catch((err) => {
    return ctx.answerCbQuery(err);
  });
  if (user_name) {
    var invite_link = "@" + user_name;
  } else if (tg_chat.invite_link) {
    var invite_link = tg_chat.invite_link;
  } else {
    var invite_link = `${tg_chat.title} : ${chat_id}`;
  }
  if (new_status == "administrator") {
    if (!getDirectories(__dirname + "/db/users").includes("" + user_id + "")) {
      return;
    }
    let user_data = fs.readFileSync(
      __dirname + "/db/users/" + user_id + "/data.json"
    );
    let u_bal = user_data.balance || 0;
    if (folders.includes("" + chat_id + "")) {
      let cha_data = fs.readFileSync(
        __dirname + "/db/channels/" + chat_id + "/data.json"
      );
      cha_data = JSON.parse(cha_data);
      delete cha_data.removed;
      cha_data.owner = user_id;
      fs.writeFileSync(
        __dirname + "/db/channels/" + chat_id + "/data.json",
        JSON.stringify(cha_data)
      );
      bot.telegram
        .sendMessage(
          user_id,
          `<b>Your Channel : ${link} Again Added To Bot</b>`,
          {
            parse_mode: "HTML",
          }
        )
        .catch((e) => console.log(e));
      return;
    }
    bot.telegram
      .sendMessage(
        admin,
        "<b>" +
          invite_link +
          ' Registed By <a href="tg://user?id=' +
          user_id +
          '">' +
          user_id +
          "</a></b>",
        {
          parse_mode: "HTML",
        }
      )
      .catch((e) => console.log(err));
    bot.telegram
      .sendMessage(user_id, "<b>" + link + " Registed</b>", {
        parse_mode: "HTML",
      })
      .catch((e) => console.log(e));
    await fs.mkdirSync(__dirname + "/db/channels/" + chat_id + "");
    fs.writeFileSync(
      __dirname + "/db/channels/" + chat_id + "/data.json",
      JSON.stringify({
        owner: ctx.from.id,
        kicked: [],
        username: ctx.update.my_chat_member.chat.username,
      })
    );
  } else {
    if (folders.includes("" + chat_id + "")) {
      let c_data = JSON.parse(
        fs.readFileSync(__dirname + "/db/channels/" + chat_id + "/data.json")
      );
      c_data.removed = true;
      fs.writeFileSync(
        __dirname + "/db/channels/" + chat_id + "/data.json",
        JSON.stringify(c_data)
      );
      bot.telegram
        .sendMessage(c_data.owner, "<b>" + link + " Removed From Bot</b>", {
          parse_mode: "HTML",
        })
        .catch((e) => console.log(e));
    }
  }
});

//Broadcast command for sending all bot users a alert by admin
bot.command("broadcast", (ctx) => {
  if (ctx.from.id != parseInt(admin)) {
    return;
  }
  ctx.scene.enter("broadcast");
});

bot.action("stop_broadcast", (ctx) => {
  broadcast_running = false;
  ctx.editMessageText("<b>Broadcast Stopped </b>", {
    parse_mode: "HTML",
  });
});

bot.catch((err) => {
  console.log(err);
});