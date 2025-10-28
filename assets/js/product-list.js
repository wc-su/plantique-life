import Swiper from 'swiper';
// import Swiper JS
import { Autoplay, Navigation, Pagination } from 'swiper/modules';
// import Swiper and modules styles
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

import 'bootstrap/dist/js/bootstrap.min.js';
import '../scss/product-list.scss';
import './components/breadcrumb';

// init Swiper:
const swiper = new Swiper('.swiper', {
  // configure Swiper to use modules
  modules: [Autoplay, Pagination],
  loop: true, // 無限循環
  autoplay: {
    delay: 5000, // 每張停留 5 秒
    disableOnInteraction: false, // 使用者操作後是否繼續自動播放 (false = 繼續)
  },
  pagination: {
    el: '.swiper-pagination',
    clickable: true,
  },
  on: {
    touchStart() {
      // 暫停動畫
      this.el.classList.add('is-paused');
    },
    touchEnd() {
      // 取消暫停
      this.el.classList.remove('is-paused');

      // 重置所有 bullets 的動畫
      this.pagination.bullets.forEach(bullet => {
        bullet.classList.remove('restart');
        void bullet.offsetWidth; // 強制重繪
        bullet.classList.add('restart');
      });
    },
  },
});

//accordion
document.querySelectorAll('.accordion-header').forEach(header => {
  header.addEventListener('click', () => {
    const item = header.parentElement;
    item.classList.toggle('active');
  });
});
