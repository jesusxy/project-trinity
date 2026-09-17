#!/usr/bin/env python3
"""Check generated internal links, IDs, published records and footer invariants."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote
import sys
root=Path(sys.argv[1] if len(sys.argv)>1 else 'public')
class Page(HTMLParser):
    def __init__(self,path):
        super().__init__();self.links=[];self.ids=[];self.h1=0;self.scripts=[];self.feed(path.read_text())
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if 'id' in a:self.ids.append(a['id'])
        if tag=='h1':self.h1+=1
        if tag=='a' and 'href' in a:self.links.append(a['href'])
        if tag=='script':self.scripts.append(a.get('src',''))
pages={p:Page(p) for p in root.rglob('*.html')}
for path,page in pages.items():
    text=path.read_text()
    if 'http-equiv=refresh' in text or 'http-equiv="refresh"' in text:continue
    assert page.h1==1,(path,'expected one h1',page.h1)
    assert len(page.ids)==len(set(page.ids)),(path,'duplicate IDs')
    assert 'IC XC NIKA' in text and 'The world will see the great result from my hands' in text,(path,'footer changed')
    if path != root/'labs/index.html':assert not page.scripts,(path,'unexpected JavaScript')
    for href in page.links:
        url=urlsplit(href)
        if url.netloc or url.scheme:continue
        target=root/unquote(url.path).lstrip('/') if url.path.startswith('/') else path.parent/unquote(url.path)
        if not url.path:target=path
        elif target.is_dir():target=target/'index.html'
        assert target.exists(),(path,'broken link',href)
        if url.fragment and target in pages:assert unquote(url.fragment) in pages[target].ids,(path,'missing anchor',href)
print(f'Checked {len(pages)} HTML files: internal links, anchors, headings, footer, script isolation.')
