window.HELP_IMPROVE_VIDEOJS = false;

var INTERP_BASE = "./static/interpolation/stacked";
var NUM_INTERP_FRAMES = 240;

var interp_images = [];
function preloadInterpolationImages() {
  for (var i = 0; i < NUM_INTERP_FRAMES; i++) {
    var path = INTERP_BASE + '/' + String(i).padStart(6, '0') + '.jpg';
    interp_images[i] = new Image();
    interp_images[i].src = path;
  }
}

function setInterpolationImage(i) {
  var image = interp_images[i];
  if (!image) return;
  image.ondragstart = function() { return false; };
  image.oncontextmenu = function() { return false; };
  var wrapper = document.getElementById('interpolation-image-wrapper');
  if (wrapper) {
    wrapper.innerHTML = '';
    wrapper.appendChild(image);
  }
}


document.addEventListener('DOMContentLoaded', function() {
    // navbar 汉堡菜单
    var burgerEls = document.querySelectorAll('.navbar-burger');
    if (burgerEls && burgerEls.length > 0) {
      burgerEls.forEach(function(burger) {
        burger.addEventListener('click', function() {
          document.querySelectorAll('.navbar-burger').forEach(function(el) {
            el.classList.toggle('is-active');
          });
          document.querySelectorAll('.navbar-menu').forEach(function(menu) {
            menu.classList.toggle('is-active');
          });
        });
      });
    }

    // 所有 carousel 的通用配置
    var carouselOptions = {
        loop: true,
        infinite: true,
        autoplay: false,
        autoplaySpeed: 3000,
    };

    // 初始化各个 carousel（依赖 bulmaCarousel 全局对象）
    if (typeof bulmaCarousel !== 'undefined') {
      bulmaCarousel.attach('#results-carousel', {
          ...carouselOptions,
          slidesToShow: 2,
          slidesToScroll: 1,
      });

      bulmaCarousel.attach('#diversity-carousel', {
          ...carouselOptions,
          slidesToShow: 4,
          slidesToScroll: 1,
      });

      bulmaCarousel.attach('#pose-carousel', {
          ...carouselOptions,
          slidesToShow: 1,
          slidesToScroll: 1,
      });

      bulmaCarousel.attach('#portrait-carousel', {
          ...carouselOptions,
          slidesToShow: 1,
          slidesToScroll: 1,
      });

      bulmaCarousel.attach('#control-carousel', {
          ...carouselOptions,
          slidesToShow: 1,
          slidesToScroll: 1,
      });
    }

    // 插值图片相关逻辑
    preloadInterpolationImages();

    var slider = document.getElementById('interpolation-slider');
    if (slider) {
      slider.addEventListener('input', function(event) {
        setInterpolationImage(this.value);
      });
      setInterpolationImage(0);
      slider.max = NUM_INTERP_FRAMES - 1;
    }

    // bulma slider 初始化
    if (typeof bulmaSlider !== 'undefined') {
      bulmaSlider.attach();
    }
});
