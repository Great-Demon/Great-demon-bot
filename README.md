GREAT DEMON V4.9


WhatsApp Automation • Group Management • Anime Collection • Telegram Integration


GREAT DEMON is a multi-purpose WhatsApp automation project built with JavaScript and Baileys. It brings together group management, media utilities, an interactive anime collection system, a player economy and optional Telegram integration.


Overview


GREAT DEMON includes:




Group administration and moderation


Anti-link and group protection features


Anime character collection and card purchasing


Player-to-player card trading


Wallet and bank economy


Player profiles and leaderboards


WhatsApp Group Status V2


Media processing and utility commands


Telegram control panel and WhatsApp account linking




Requirements




Node.js 22 or newer


npm


Git


WhatsApp account


Telegram account (for Telegram integration)


Render account (for cloud deployment)




Installation


Clone the repository:


git clone YOUR_REPOSITORY_URL



Enter the project directory:


cd GREAT-DEMON-V4



Install dependencies:


npm install



Start the bot:


npm start



Complete the WhatsApp authentication process when prompted.


Deployment on Render


GREAT DEMON can be deployed as a Node.js Web Service on Render.


Step 1 — Upload to GitHub


Upload the project files to a GitHub repository. Ensure the repository includes:




index.js


package.json


package-lock.json




Step 2 — Create a Render Web Service




Visit https://render.com/


Sign in and select New → Web Service.


Connect your GitHub account.


Select your GREAT DEMON repository.


Configure the service:






Setting
Value




Runtime
Node


Build Command
npm install


Start Command
npm start




Deploy the service and check the logs for errors.


Step 3 — Configure Persistent Storage


Persistent storage is important for keeping WhatsApp sessions, economy data, card collections and settings across deployments.




Open your Render service.


Add a Persistent Disk.


Set the mount path to /var/data.


Open the Environment settings.


Add:






Key
Value




DATA_DIR
/var/data




Save the configuration.


Without a persistent disk, locally stored bot data may be lost after a restart or redeployment.


Telegram Setup


Telegram integration provides access to the GREAT DEMON control panel and WhatsApp account linking.


Step 1 — Create a Telegram Bot




Open Telegram.


Search for @BotFather.


Send /newbot.


Follow the instructions.


Copy the API token provided by BotFather.




Keep the token private.


Step 2 — Get Your Telegram ID




Open your GREAT DEMON Telegram bot.


Send /start.


Send /myid.


Your numeric Telegram ID will be displayed.




Your Telegram ID is different from your Telegram username.


Step 3 — Connect Telegram to Render


Open your Render service and navigate to Environment.


Add these variables:




Variable
Description




TELEGRAM_BOT_TOKEN
Token received from BotFather


TELEGRAM_OWNER_ID
Your numeric Telegram ID




Save the changes and restart or redeploy the service.


Telegram Commands




Command
Description




/start
Open the control panel


/connect
Link a WhatsApp account


/listdevices
View linked sessions


/delpair
Unlink a WhatsApp session


/addid
Enable personal security and bug reports


/myid
Display Telegram ID and report status


/removeid
Disable personal security and bug reports


/status
Check connection status




Telegram integration is optional. Without TELEGRAM_BOT_TOKEN, the WhatsApp bot can start without the Telegram manager.


WhatsApp Owner Configuration


The WhatsApp owner number is configured in index.js.


Find the OWNER_NUMBER setting and ensure it contains the correct number in international format, without the leading +.


Example:


const OWNER_NUMBER = "234XXXXXXXXXX";



The WhatsApp owner number and Telegram owner ID are separate settings.


Anime Collection System


GREAT DEMON includes an interactive anime character collection system.


Players can collect characters, purchase available cards and build their own collections.




Command
Description




.spawncard
Spawn and purchase a random card


.cardshop
Browse available cards


.cardbuy <ID>
Purchase a listed card


.mycards
View your collection




Card Trading


Players can make card sale offers or propose exchanges.




Command
Description




.cardoffer @user <cardID> <price>
Offer a card for sale


.cardtrade @user <yourCardID> <theirCardID> [extraGD]
Propose a card exchange


.cardaccept <tradeID>
Accept a trade


.cardconfirm <tradeID>
Confirm the exchange


.tradecancel <tradeID>
Cancel a pending trade




Pending trades expire after 30 minutes.


Card Ranks and Prices




Rank
Price




S
100,000 GD


A
50,000 GD


B
20,000 GD


C
10,000 GD


D
5,000 GD


E
2,000 GD




Economy System


The economy includes player wallets, bank accounts, profiles and rankings.




Command
Description




.profile
View your profile


.profile @user
View another player's profile


.balance
Check your wallet


.bank
Check your bank


.deposit <amount>
Deposit money


.withdraw <amount>
Withdraw money


.richest
View the richest player


.leaderboard
View economy rankings




Group Management


GREAT DEMON provides group administration and protection tools.


Available features include moderation, anti-link protection, automated group safeguards and administrator controls.


Some commands require group administrator or bot owner permissions.


WhatsApp Status


The project includes Group Status V2 functionality for sharing supported content through WhatsApp Status.


Availability depends on the installed Baileys version and the supported status implementation.


Configuration and Data


The bot stores persistent information such as:




WhatsApp authentication sessions


Economy accounts


Anime card collections


Group settings


Bot settings


Message statistics




Back up your persistent data before replacing or updating the project.


Troubleshooting


Bot does not start


Check the Render logs, Node.js version and dependency installation.


Telegram bot does not respond


Check TELEGRAM_BOT_TOKEN and ensure the Telegram bot token is valid.


Security alerts are not received


Check TELEGRAM_OWNER_ID and make sure you have started a conversation with your Telegram bot.


Data disappears after deployment


Check that the Render Persistent Disk is mounted at /var/data and that DATA_DIR is set to /var/data.


WhatsApp disconnects


Check the authentication session and reconnect the account if necessary.


Security




Never publish WhatsApp session credentials.


Never expose your Telegram bot token.


Keep owner configuration private.


Back up persistent data regularly.


Only use trusted sources for project updates.




Disclaimer


GREAT DEMON is an independent software project. It is not affiliated with, endorsed by or officially associated with WhatsApp, Meta or Telegram.


Users are responsible for how they configure and operate the software and must comply with the applicable platform terms.



Project Information




Property
Details




Project
GREAT DEMON


Version
4.9.0


Language
JavaScript


Runtime
Node.js


WhatsApp Library
Baileys


Hosting Support
Render


Telegram Integration
Optional




GREAT DEMON V4.9 — Project Documentation


