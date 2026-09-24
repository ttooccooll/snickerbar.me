# Snickerbar 🎃

A Halloween bitcoin ecash wallet (a fork of the [Cashu.me](https://github.com/cashubtc/cashu.me) wallet). Hand out real sats to trick-or-treaters: fill a "treat bag" and print one card per kid, each with a QR code worth a few sats.

Only load it with small amounts you're happy to give away. This is still a beta wallet.

## Halloween how-to

1. Join a mint and fund the wallet over Lightning (**Receive → Lightning**).
2. **Send → Ecash** opens the treat bag:
   - **How many treats**, and how much each: the same for all, a random **Mystery 🎲** amount between a min and a max, or **Custom** per treat.
   - Powers of two (8, 16, 32, 64, 128…) fit in a single ecash note, so their QR codes are smaller and easier to scan.
   - **Claim link** QR codes work with any phone camera: they open this wallet with the treat ready to claim. **Raw ecash token** QR codes are smaller but need a Cashu wallet app. You can point claim links at another wallet that accepts `?token=` under **Claim link settings**.
3. Hit **Fill the bag**, then **Print**. Four cards fit on a Letter/A4 page. The ink-saver toggle prints them on white.
4. Keep the sheet open to watch treats get claimed (👻 3/5 claimed). Reopen it any time from the **🎃 unclaimed treats** button on the home screen.
5. After Halloween, use **Take back unclaimed treats** (↶) to move any unclaimed sats back into your wallet. Their printed QR codes stop working.

Mints that charge a fee per transaction are not supported yet. The treat bag will tell you to pick a fee-free mint.

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
