import Swiper from 'swiper';
// import Swiper JS
import { Autoplay, Navigation, Pagination } from 'swiper/modules';
// import Swiper and modules styles
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

import 'bootstrap/dist/js/bootstrap.min.js';
import '/assets/scss/product-list.scss';

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
});

// const swiper = new Swiper('.swiper', {
//   loop: true, // 無限循環
//   autoplay: {
//     delay: 3000, // 每張停留 3 秒
//     disableOnInteraction: false, // 使用者操作後是否繼續自動播放 (false = 繼續)
//   },
//   pagination: {
//     el: '.swiper-pagination',
//     clickable: true,
//   },
// });
