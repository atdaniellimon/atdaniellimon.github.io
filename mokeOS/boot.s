MBOOT_MAGIC    equ 0x1BADB002
; Request basic multiboot features only:
; bit0 = align modules, bit1 = memory info.
MBOOT_FLAGS    equ 0x00000003
; TODO: Add VBE support in kernel before enabling bit2 (0x00000004).
; Enabling VBE here makes the bootloader pass video mode metadata that
; the current kernel does not parse yet.
; MBOOT_FLAGS_VBE equ 0x00000007
MBOOT_CHECKSUM equ -(MBOOT_MAGIC + MBOOT_FLAGS)

section .multiboot
align 4
    dd MBOOT_MAGIC
    dd MBOOT_FLAGS
    dd MBOOT_CHECKSUM
    ; TODO: Add these multiboot video fields when VBE handling exists.
    ; They are required only when bit2 (VBE request) is enabled.
    ; dd 0                ; mode_type (0 = linear graphics)
    ; dd 1024             ; width
    ; dd 768              ; height
    ; dd 32               ; depth

section .text
extern main
global _start

_start:
    cli
    mov esp, stack_space + 8192
    push ebx
    call main

halt:
    hlt
    jmp halt

section .bss
align 16
stack_space:
    resb 8192