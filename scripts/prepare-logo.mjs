// يستخرج حبر الشعار من صورة الورق إلى PNG شفاف بلونين (داكن وفاتح)
// الاستخدام: node scripts/prepare-logo.mjs "../شعار محل مازن.jpeg"
import sharp from "sharp";
import path from "node:path";

const src = process.argv[2];
if (!src) {
  console.error("حدد مسار صورة الشعار");
  process.exit(1);
}
const outDir = path.resolve("public");

// العتبات: أي بكسل أفتح من LIGHT يُعتبر ورقاً، وأغمق من DARK حبراً كاملاً
const LIGHT = 150;
const DARK = 95;

const { data, info } = await sharp(src)
  .greyscale()
  .median(3) // يخفف ملمس الورق
  .raw()
  .toBuffer({ resolveWithObject: true });

const alpha = Buffer.alloc(info.width * info.height);
for (let i = 0; i < data.length; i++) {
  const v = data[i];
  alpha[i] = v >= LIGHT ? 0 : v <= DARK ? 255 : Math.round(((LIGHT - v) / (LIGHT - DARK)) * 255);
}

async function render(hex, name) {
  const [r, g, b] = [1, 3, 5].map((o) => parseInt(hex.slice(o, o + 2), 16));
  const rgba = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0; i < alpha.length; i++) {
    rgba[i * 4] = r;
    rgba[i * 4 + 1] = g;
    rgba[i * 4 + 2] = b;
    rgba[i * 4 + 3] = alpha[i];
  }
  const trimmed = await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer();
  // قص أولي ثم إزالة نقطة شاردة أسفل الشعار (ملمس الورق) وقص نهائي
  const first = await sharp(trimmed).trim({ threshold: 1 }).toBuffer({ resolveWithObject: true });
  const cut = Math.round(first.info.height * 0.025);
  const cleaned = await sharp(first.data)
    .extract({ left: 0, top: 0, width: first.info.width, height: first.info.height - cut })
    .toBuffer();
  await sharp(cleaned)
    .trim({ threshold: 1 })
    .resize({ width: 900, withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toFile(path.join(outDir, name));
  console.log("✓", name);
}

await render("#262422", "logo-ink.png");
await render("#F4F1EA", "logo-light.png");

// أيقونة الموقع: شعار داكن على خلفية الورق
const ink = await sharp(path.join(outDir, "logo-ink.png"))
  .resize(220, 220, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .toBuffer();
await sharp({ create: { width: 256, height: 256, channels: 4, background: "#F4F1EA" } })
  .composite([{ input: ink, gravity: "center" }])
  .png()
  .toFile(path.resolve("src/app/icon.png"));
console.log("✓ icon.png");
