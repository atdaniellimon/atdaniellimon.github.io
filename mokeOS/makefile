#mokeOS beta!!

UNAME_S := $(shell uname -s 2>/dev/null || echo Unknown)

# Prefer bare-metal cross tools; on Linux fall back to distro cross/native tools.
ifeq ($(UNAME_S),Linux)
	OS_CFLAGS := -fno-stack-protector -fno-pie -fno-pic -mno-mmx -mno-sse -mno-sse2 -mno-80387 -msoft-float -fno-tree-vectorize
	ifneq ($(shell command -v i686-elf-gcc 2>/dev/null),)
		CC := i686-elf-gcc
		LNK := i686-elf-ld
		ARCH_CFLAGS := -march=i386
		ARCH_LDFLAGS :=
	else ifneq ($(shell command -v i686-linux-gnu-gcc 2>/dev/null),)
		CC := i686-linux-gnu-gcc
		LNK := i686-linux-gnu-ld
		ARCH_CFLAGS := -march=i386
		ARCH_LDFLAGS :=
	else
		CC := gcc
		LNK := ld
		ARCH_CFLAGS := -m32 -march=i386
		ARCH_LDFLAGS := -m elf_i386
	endif
else
	OS_CFLAGS :=
	CC := i686-elf-gcc
	LNK := i686-elf-ld
	ARCH_CFLAGS :=
	ARCH_LDFLAGS :=
endif

AS := nasm

# Freestanding kernel build flags.
CFLAGS := -std=gnu99 -ffreestanding -O2 -Wall -Wextra $(OS_CFLAGS)

OBJS = boot.o kernel.o
OUTPUT = mokeos.bin

all: $(OUTPUT)

$(OUTPUT): $(OBJS)
	$(LNK) $(ARCH_LDFLAGS) -T linker.ld -o $(OUTPUT) $(OBJS)

boot.o: boot.s
	$(AS) -f elf32 boot.s -o boot.o

kernel.o: kernel.c
	$(CC) -c kernel.c -o kernel.o $(CFLAGS) $(ARCH_CFLAGS)

clean:
	rm -f *.o $(OUTPUT) mokeos.iso