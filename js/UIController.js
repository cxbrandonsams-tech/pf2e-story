// Wires DOM controls to BookController and AudioController.
// Uses defensive `if (el)` checks so the same controller works against both
// the legacy HTML (during the transition) and the new Stitch shell.

export class UIController {
  constructor({ book, audio }) {
    this.book = book;
    this.audio = audio;

    this.btnPrev     = document.getElementById('btn-prev');
    this.btnPlay     = document.getElementById('btn-play');
    this.btnPlayIcon = document.getElementById('btn-play-icon'); // new shell only
    this.btnNext     = document.getElementById('btn-next');
    this.volume      = document.getElementById('volume');
    this.volumeLabel = document.getElementById('volume-label');  // new shell only
    this.speed       = document.getElementById('speed');

    this._bindEvents();
    this._initFromDOM();
    this._sync();

    this.book.onChange = () => this._sync();
  }

  _bindEvents() {
    if (this.btnPrev) this.btnPrev.addEventListener('click', () => this.book.prev());
    if (this.btnNext) this.btnNext.addEventListener('click', () => this.book.next());
    if (this.btnPlay) this.btnPlay.addEventListener('click', () => this.book.toggle());

    if (this.volume) {
      this.volume.addEventListener('input', e => {
        const v = Number(e.target.value);
        this.audio.setVolume(v / 100);
        this._updateVolumeLabel(v);
        this._updateVolumeFill(v);
      });
    }

    if (this.speed) {
      this.speed.addEventListener('change', e => {
        this.audio.setRate(Number(e.target.value));
      });
    }

    document.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft')  { this.book.prev(); }
      if (e.key === 'ArrowRight') { this.book.next(); }
      if (e.key === ' ')          { e.preventDefault(); this.book.toggle(); }
    });
  }

  _initFromDOM() {
    if (this.volume) {
      const v = Number(this.volume.value);
      this.audio.setVolume(v / 100);
      this._updateVolumeLabel(v);
      this._updateVolumeFill(v);
    }
    if (this.speed) {
      this.audio.setRate(Number(this.speed.value));
    }
  }

  _updateVolumeLabel(v) {
    if (this.volumeLabel) this.volumeLabel.textContent = `${v}%`;
  }

  _updateVolumeFill(v) {
    // Drives the CSS gradient fill in the new Stitch slider styling.
    if (this.volume) this.volume.style.setProperty('--vol', `${v}%`);
  }

  _sync() {
    if (this.btnPlayIcon) {
      // Swap the Material icon between the universal play arrow (paused) and
      // pause bars (playing). The button label always reads "Play".
      this.btnPlayIcon.textContent = this.book.isPlaying ? 'pause' : 'play_arrow';
    } else if (this.btnPlay) {
      // Legacy shell fallback: the button itself has text content directly.
      this.btnPlay.textContent = this.book.isPlaying ? '\u23F8' : '\u25B6';
    }
  }
}
