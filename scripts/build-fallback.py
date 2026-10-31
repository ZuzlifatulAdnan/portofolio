import json
from pathlib import Path
root=Path(__file__).resolve().parent.parent
seed=root/'data/seed'; dst=root/'public/js/content.js'
locales={l:json.loads((seed/f'{l}.json').read_text(encoding='utf-8')) for l in ('id','en')}
ui=json.loads((seed/'ui.json').read_text(encoding='utf-8'))
dst.write_text('/* Generated demo fallback: edit content in /admin when the Node server is running. */\nwindow.PORTFOLIO_SEED = '+json.dumps(locales,ensure_ascii=False,separators=(',',':'))+';\nwindow.PORTFOLIO_UI = '+json.dumps(ui,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf8')
print('wrote localized content.js')
