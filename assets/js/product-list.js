import '/assets/scss/product-list.scss';
import 'bootstrap/dist/js/bootstrap.min.js';

const swiper = new Swiper('.swiper', {
  loop: true, // 無限循環
  autoplay: {
    delay: 3000, // 每張停留 3 秒
    disableOnInteraction: false, // 使用者操作後是否繼續自動播放 (false = 繼續)
  },
  pagination: {
    el: '.swiper-pagination',
    clickable: true,
  },
});
