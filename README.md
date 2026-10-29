# Snickerbar 🎃

A Halloween bitcoin ecash wallet (a fork of the [Cashu.me](https://github.com/cashubtc/cashu.me) wallet). Hand out real sats to trick-or-treaters: fill a "treat bag" and print one card per kid, each with a QR code worth a few sats.

Only load it with small amounts you're happy to give away. This is still a beta wallet.

## Halloween how-to

1. Join a public Cashu mint (you don't run your own) and fund the wallet over Lightning (**Receive → Lightning**).
2. **Send → Ecash** opens the treat bag:
   - **How many treats**, and how much each: the same for all, a random **Mystery 🎲** amount between a min and a max, or **Custom** per treat.
   - Powers of two (8, 16, 32, 64, 128…) fit in a single ecash note, so their QR codes are smaller and easier to scan.
   - **Claim link** QR codes work with any phone camera: they open this wallet with the treat ready to claim. **Raw ecash token** QR codes are smaller but need a Cashu wallet app. You can point claim links at another wallet that accepts `?token=` under **Claim link settings**.
3. Hit **Fill the bag**. Each printed card has a cursed treat name for the kid (_"The Haunted Nougat of Eternal Screaming"_) and three simple steps for the grown-up who claims it. Then either:
   - **Print**: four cards fit on a Letter/A4 page. The ink-saver toggle prints them on white.
   - **Porch mode** 🚪: no printer needed. Prop a tablet or phone at the door and it shows one giant QR code at a time. When a parent claims it, a ghost celebrates and the next treat pops up. The screen stays awake and plays a ghostly "wooo" plus a candy chime for every claim (🔊 to mute). When you run out, it shows how many sats went to how many trick-or-treaters, and **Fill another bag** makes more treats without leaving the door.
4. Keep the sheet open to get a "👻 Treat #3 was just claimed!" alert (with candy rain) whenever a treat is claimed. Reopen it any time from the **🎃 unclaimed treats** button on the home screen.
5. Each card gets its own monster (🎃 👻 🦇 🕷️ 🧙 💀) and color.
6. After Halloween (the home screen reminds you in November), use **Take back unclaimed treats** (↶) to move any unclaimed sats back into your wallet. Their printed QR codes stop working.

Parents who open a claim link skip the wallet intro and get a full-screen "You got a treat!" with the amount in big numbers and one big **Receive my treat** button, then a shower of candy. If the card was already claimed (say, earlier in another browser), the screen says so right away and where to look for the sats.

Mints that charge a small fee per transaction (like mint.coinos.io) work too. The treat bag tells you about the fee, and parents get a sat or so less than the card says when they claim it.

## Trunk-or-Treat (no screen)

Everything happens on paper, so parents only need their phone:

1. Make the treats anywhere: on snickerbar.me or on your own laptop with `npm run dev`. The claim links printed on the cards always open a public wallet (snickerbar.me by default) and never `localhost`. If you type in another wallet address, the treat bag warns you when phones couldn't open it.
2. Pick amounts parents can actually spend. A few hundred sats or more survives Lightning fees, and powers of two (512, 1,024, 2,048, 4,096) make the smallest QR codes. A couple of 4,096-sat cards make great "free milkshake" prizes.
3. **Fill the bag**, turn on **Sign** in the toolbar, then **Print**. Page 1 is a big "Free Bitcoin Treats" sign for your trunk, then the cards follow, up to four per page. Ink saver prints everything on white.
4. Test one card the night before: scan it with your phone on cellular data (not Wi-Fi), tap **Receive my treat**, and spend a few sats.

When a parent scans a card, the wallet skips its intro and shows "You got a treat!" full screen. One tap on **Receive my treat** and a shower of candy. Then the wallet tells them plainly that the sats sit in a temporary wallet that lives only in their browser (gone if the browser's data is cleared or snickerbar.me shuts down) and offers **Move them to my wallet**: they enter their own Lightning address (name@coinos.io, name@strike.me, $cashtag@cash.app, …) and the wallet sends everything it can after fees, in one tap. No wallet yet? It points them to coinos.io, which is free and runs in the browser. Until they move their sats, a warning with a **Move to my wallet** button stays on their home screen.

Spending opens a big **Scan a QR code** button: it reads store QR codes in any form, including `lightning:` links, upper case invoices and `bitcoin:` QR codes that carry a Lightning invoice. Before paying, the wallet shows the fees and the total. If the sats don't cover the fees, one tap sends a little less ("Send 1,013 sat instead"), or **Change amount** goes back to the amount without retyping the Lightning address. After the event, reopen the bag from the 🎃 button on the home screen and **take back** whatever nobody claimed.

### Keep snickerbar.me up

Parents' treats live in their browser's storage for snickerbar.me. Keep the site online at least until you take back the unclaimed treats, and longer if you can, so late parents can still move their sats. Anyone who has moved their sats to their own wallet no longer needs it.

To have cards open a different wallet instead, put its link in **Claim link settings** → **Wallet that opens the link**. The ecash is added as `?token=…`, or put `{token}` where the wallet expects it (for example `https://wallet.example/ecash/{token}`). Scan a test card before printing a batch.

# Cashu (cashu)

## One-liner build & run

```
docker-compose up -d
```

access at http://localhost:3000 or serve it behind a reverse proxy.

## Install the dependencies

```bash
npm install
```

### Start the app in development mode (hot-code reloading, error reporting, etc.)

```bash
npm run dev
```

### Run unit tests

```bash
npm run test:ci
```

### Lint the files

```bash
npm run lint
```

### Format the files

```bash
npm run format
```

### Build the app for production

```bash
npm run build
```

### Customize the configuration

See [Configuring quasar.config.js](https://v2.quasar.dev/quasar-cli-webpack/quasar-config-js).
