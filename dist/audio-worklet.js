class MelonDSAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.capacity = sampleRate * 2;
    this.samples = new Float32Array(this.capacity);
    this.readPosition = 0;
    this.writePosition = 0;
    this.volume = 0.8;
    this.sourceRate = sampleRate;
    this.phase = 0;
    this.port.onmessage = ({ data }) => {
      if (data.type === 'volume') {
        this.volume = data.volume;
        return;
      }
      if (data.type === 'sample-rate') {
        this.sourceRate = data.rate;
        this.phase = 0;
        this.readPosition = this.writePosition;
        return;
      }
      if (data.type !== 'samples') return;
      const samples = new Int16Array(data.buffer);
      for (const sample of samples) {
        this.samples[this.writePosition] = sample / 32768;
        this.writePosition = (this.writePosition + 1) % this.capacity;
        if (this.writePosition === this.readPosition) {
          this.readPosition = (this.readPosition + 2) % this.capacity;
        }
      }
    };
  }

  process(_inputs, outputs) {
    const output = outputs[0];
    const left = output[0];
    const right = output[1] || output[0];
    for (let index = 0; index < left.length; index++) {
      if (this.readPosition === this.writePosition) {
        left[index] = 0;
        right[index] = 0;
      } else {
        const current = this.readPosition;
        const next = (current + 2) % this.capacity;
        const hasNext = next !== this.writePosition;
        const fraction = this.phase;
        const currentLeft = this.samples[current];
        const currentRight = this.samples[(current + 1) % this.capacity];
        const nextLeft = hasNext ? this.samples[next] : currentLeft;
        const nextRight = hasNext ? this.samples[(next + 1) % this.capacity] : currentRight;
        left[index] = (currentLeft + (nextLeft - currentLeft) * fraction) * this.volume;
        right[index] = (currentRight + (nextRight - currentRight) * fraction) * this.volume;
        this.phase += this.sourceRate / sampleRate;
        while (this.phase >= 1 && this.readPosition !== this.writePosition) {
          this.readPosition = (this.readPosition + 2) % this.capacity;
          this.phase -= 1;
        }
      }
    }
    return true;
  }
}

registerProcessor('melonds-audio', MelonDSAudioProcessor);