// Wires DOM controls to BookController, AudioController, and MusicController.

export class UIController {
  constructor({ book, audio, music }) {
    this.book = book;
    this.audio = audio;
    this.music = music;

    this.btnRestart  = document.getElementById('btn-restart');
    this.btnPrev     = document.getElementById('btn-prev');
    this.btnPlay     = document.getElementById('btn-play');
    this.btnNext     = document.getElementById('btn-next');
    this.pageJump    = document.getElementById('page-jump');
    this.pageTotal   = document.getElementById('page-total');
    this.volume      = document.getElementById('volume');
    this.speed       = document.getElementById('speed');
    this.btnMusic    = document.getElementById('btn-music');
    this.musicWrap   = document.getElementById('music-wrapper');
    this.musicVolume = document.getElementById('music-volume');

    this._populatePageJump();
    this._bindEvents();
    this._sync();

    this.book.onChange = () => this._sync();
  }

  _populatePageJump() {
    const total = this.book.totalPages;
    this.pageTotal.textContent = String(total);
    this.pageJump.innerHTML = '';
    for (let i = 0; i < total; i++) {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = String(i + 1);
      this.pageJump.appendChild(opt);
    }
  }

  _bindEvents() {
    this.btnRestart.addEventListener('click', () => this.book.restart());
    this.btnPrev.addEventListener('click',    () => this.book.prev());
    this.btnNext.addEventListener('click',    () => this.book.next());
    this.btnPlay.addEventListener('click',    () => this.book.toggle());

    this.pageJump.addEventListener('change', e => {
      this.book.jumpTo(Number(e.target.value));
    });

    this.volume.addEventListener('input', e => {
      this.audio.setVolume(Number(e.target.value) / 100);
    });

    this.speed.addEventListener('change', e => {
      this.audio.setRate(Number(e.target.value));
    });

    this.btnMusic.addEventListener('click', () => {
      if (this.music && this.music.hasSource) {
        this.music.start();
        this.music.toggleMute();
        this.btnMusic.classList.toggle('active', !this.music.isMuted);
      }
    });
    this.musicWrap.addEventListener('mouseenter', () => this.musicWrap.classList.add('open'));
    this.musicWrap.addEventListener('mouseleave', () => this.musicWrap.classList.remove('open'));

    this.musicVolume.addEventListener('input', e => {
      if (this.music) this.music.setVolume(Number(e.target.value) / 100);
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft')  { this.book.prev(); }
      if (e.key === 'ArrowRight') { this.book.next(); }
      if (e.key === ' ')          { e.preventDefault(); this.book.toggle(); }
    });

    this.audio.setVolume(Number(this.volume.value) / 100);
    this.audio.setRate(Number(this.speed.value));
    if (this.music) this.music.setVolume(Number(this.musicVolume.value) / 100);

    if (this.music && this.music.hasSource && !this.music.isMuted) {
      this.btnMusic.classList.add('active');
    }
  }

  _sync() {
    this.btnPlay.textContent = this.book.isPlaying ? '\u23F8' : '\u25B6';
    this.pageJump.value = String(this.book.currentPageNumber - 1);
  }
}
