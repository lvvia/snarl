// meowmix0 'rithm, insert description here o algo así
// SPDX-License-Identifier: 0BSD
// deno-fmt-ignore-file

const LUT = "m me mew meow mrow mrrr ow mreow rr nya prr purr rrr eow miao mraow nyaa purrs mrew brrt mrp mrrp mewl yowl"
	.split(" ");

// thats why u lwk shouldnt let yo feline step on the keyboard
function purrmux0(input: string) {
	// the birth and negation of a pair of breasts
	let h = (0x2545f491 ^ 0x80085 ^ input.length) >>> 0; // my brutha in christ what the actual fuck is this❓
	                                                     // pls get the children outta the room

	for (let i = 0; i < input.length; i++) {
		const disgrace = input.codePointAt(i)!;
		if (disgrace > 0xFFFF) i++; // utf-16 surrogate pair still hates ur whole bloodline

		h = Math.imul(h ^ disgrace, 0x9e3779b9); // 2³² ÷ Φ
		h = (h << 13) | (h >>> 19);
	}

	// hoe thinks it be murmurhash 🥀
	h ^= h >>> 15;
	h = Math.imul(h, 0x85ebca77);
	h ^= h >>> 13;
	h = Math.imul(h, 0xc2b2ae35);
	h ^= h >>> 16;
	return h >>> 0;
}

export default function meowmix0(input: string): string {
	if (!input) return "";
	let bits = purrmux0(input);
	let mrrp = "";

	for (let i = 0; i < 6; i++) {
		const idx = bits % LUT.length;
		const word = LUT[idx];

		mrrp += i % 2 === 0 ? word[0].toUpperCase() + word.slice(1) : word;
		bits = (Math.imul(bits, 0x9e3779b9) ^ (bits >>> 7)) >>> 0;
	}

	return mrrp;
}
