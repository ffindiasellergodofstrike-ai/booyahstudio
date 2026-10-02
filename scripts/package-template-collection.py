"""Create customer ZIPs and upload manifest outside the public site."""
from pathlib import Path
import json,zipfile,hashlib,os,csv,io
root=Path(__file__).resolve().parents[1]
out=Path(os.environ.get('WORKSPACE_ROOT','/home/vercel-sandbox/workspace'))/'output'
folder=out/'booyah-products';folder.mkdir(parents=True,exist_ok=True)
products=json.loads((root/'templates/collection.json').read_text());manifest=[]
for p in products:
 dest=folder/(p['id']+'.zip')
 with zipfile.ZipFile(dest,'w',zipfile.ZIP_DEFLATED) as z:
  for source in sorted((root/'templates'/p['id']).iterdir()):
   if source.is_file():z.write(source,source.name)
 with zipfile.ZipFile(dest) as z:
  assert z.testzip() is None
  assert len([n for n in z.namelist() if n.endswith('.html')])==4
  assert 'LICENSE.txt' in z.namelist() and 'vercel.json' in z.namelist()
  assert 'preview-watermark' not in z.read('index.html').decode()
 manifest.append(dict(productId=p['id'],title=p['name'],priceINR=p['price'],zip=dest.name,bytes=dest.stat().st_size,sha256=hashlib.sha256(dest.read_bytes()).hexdigest(),downloadEnvironmentKey='PRODUCT_DOWNLOAD_URL_'+p['id'].replace('-','_').upper(),page='https://www.booyahstudio.shop/product/'+p['id'],demo='https://www.booyahstudio.shop/demos/'+p['id']+'/'))
(folder/'upload-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
with (folder/'upload-manifest.csv').open('w',newline='') as f:
 w=csv.DictWriter(f,fieldnames=list(manifest[0]));w.writeheader();w.writerows(manifest)
(folder/'UPLOAD-GUIDE.md').write_text('''# BOOYAH STUDIO — 20 original products

Each ZIP is a complete, unwatermarked source package with four pages, original SVG artwork, CSS/JavaScript, README, license and Vercel configuration. Prices in upload-manifest.csv are the store selling prices in INR. Demo service/product rates inside a template are illustrative and separate.

## Connect paid delivery on your store
1. Upload each individual ZIP to your protected file host or use a complete MEGA file link. Do not put the ZIP files in the website public/ directory or expose their URLs in product descriptions.
2. In the BOOYAH STUDIO Vercel project, add the matching PRODUCT_DOWNLOAD_URL_... environment variable from the manifest, with the direct HTTPS ZIP URL or complete MEGA file link including its fragment key. Keep these server-only; do not prefix with VITE_.
3. Apply variables to the intended deployment environment and redeploy. Verify the actual archive can be downloaded by the server and is a ZIP.
4. Confirm approved live gateway settings, your Firebase configuration and verified Resend sender. A verified LIVE payment can then use the existing protected delivery flow. Test payments still send only the test notice and never unlock these ZIPs.
5. Each product listing, thumbnail and watermarked demo is already in the store source. Do not create a second catalog item with a different ID.

## Deploy an individual purchased template
Unzip its folder, import it as a separate Vercel project, choose Other, leave the build command empty and use the project root as output. No Node dependencies or secrets are required. Test all four HTML pages. Use README.md to edit content and connect your own backend where required. The enquiry form only builds a local draft; it does not send mail.

## What was checked
All 20 template principal interactions and mobile widths were exercised in the shared browser. The source contains no third-party photos, fonts, logos, audio or CDN scripts. Original artwork is SVG geometry. No invented ratings, reviews or crossed-out discounts were added. This does not constitute global trademark clearance or a gateway approval guarantee. Existing six imported products are not covered by this new-source provenance statement.

Product IDs and checksums are in upload-manifest.json. Keep a backup of these ZIPs. The master collection ZIP is for the owner; customers should receive only the individual ZIP they purchased.
''')
with zipfile.ZipFile(out/'booyah-20-products.zip','w',zipfile.ZIP_DEFLATED) as z:
 for p in sorted(folder.iterdir()):z.write(p,'booyah-products/'+p.name)
print(f'Packaged and verified {len(manifest)} individual ZIPs and master bundle.')
