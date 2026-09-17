---
title: "PE address spaces"
date: 2026-09-17
lastmod: 2026-09-17
record_id: "REC-001"
record_class: "research"
status: "active notes"
revision: 1
description: "File offsets, relative virtual addresses, and the boundary between inspection and loading."
related: ["/projects/loupe", "/research/static-inspection"]
revisions:
  - revision: 1
    date: "2026-09-17"
    note: "Documented the address model used by Loupe’s PE reader and native loader."
---

## Three coordinates

A PE file describes an image that a loader can place in memory. Its position on disk and its intended position in memory are different coordinates.

- **File offset** counts bytes from the beginning of the file.
- **Relative virtual address (RVA)** counts bytes from the beginning of the loaded image.
- **Virtual address (VA)** is an address in a process’s virtual address space.

The optional header supplies a preferred image base. Loupe’s reader calculates a preferred entry address from that base and `AddressOfEntryPoint`:

```text
preferred entry VA = ImageBase + AddressOfEntryPoint
```

This is a description of the requested layout. Static inspection does not show where Windows actually loaded a file. A real loader may relocate the image.

## A section has two extents

Loupe keeps the section descriptors returned by Go’s PE reader. Four values are especially useful:

| Field in the Lab | Meaning |
| --- | --- |
| File offset | `PointerToRawData`: where the section’s file bytes start |
| Raw size | `SizeOfRawData`: the extent stored on disk |
| Virtual address (RVA) | `VirtualAddress`: where the section begins relative to the image base |
| Virtual size | `VirtualSize`: the declared in-memory extent |

Raw size and virtual size need not agree. Alignment can add file padding; an in-memory region can also require zero-filled bytes with no corresponding file data.

For an RVA inside the file-backed portion of a section, the relationship is:

```text
file offset = PointerToRawData + (RVA − section.VirtualAddress)
```

That expression is valid only after checking the RVA falls inside that section, the displacement is below `SizeOfRawData`, and the resulting byte range exists in the file. An RVA in a zero-filled tail has no file byte to preview.

## What Loupe shows

The Lab displays the preferred image base, entry RVA, computed entry VA, and each section’s declared layout. Its section bars compare **raw byte sizes**, not runtime memory use. Permission flags come from the section characteristics; they describe the file’s request, not an observed memory map.

The native loader is a separate step. In the inspected implementation it maps selected section names into Unicorn and assigns permissions from a name-based table. That simplified policy is not equivalent to implementing all Windows loader behavior.

## References

- [Microsoft’s PE/COFF specification](https://learn.microsoft.com/en-us/windows/win32/debug/pe-format), especially section headers and the optional header.
- [Loupe native loader, source revision 9439f51](https://github.com/jesusxy/loupe/blob/9439f51fc84946046d6755c76cddeed58ba401e8/cmd/main.go): `parsePE` and `loadPESections`.

[Inspect these fields in Loupe →]({{< relref "/labs" >}})
