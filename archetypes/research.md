---
title: '{{ replace .File.ContentBaseName "-" " " | title }}'
date: {{ .Date }}
lastmod: {{ .Date }}
draft: true
record_id: "" # Assign the next unused REC identifier before publishing.
record_class: "research"
status: "active notes"
revision: 1
description: ""
related: [] # Hugo content paths, e.g. /projects/loupe or /canon
revisions:
  - revision: 1
    date: {{ .Date.Format "2006-01-02" }}
    note: "Initial record."
---
