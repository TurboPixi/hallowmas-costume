var controlHeight = 150;

var app = new PIXI.Application({ backgroundColor: 0xffffff, forceCanvas: true, antialias:true, resolution: 2 });
app.renderer.view.style.position = "absolute";
app.renderer.view.style.display = "block";
app.renderer.view.style.zIndex = "100";
app.renderer.autoDensity = true;
app.renderer.resize(window.innerWidth, window.innerHeight-controlHeight);
document.body.appendChild(app.view);

app.stage.updateLayersOrder = function () {
  app.stage.children.sort(function(a,b) {
    a.zIndex = a.zIndex || 0;
    b.zIndex = b.zIndex || 0;
    return b.zIndex - a.zIndex
  });
};

PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;

if (!HTMLCanvasElement.prototype.toBlob) {
  Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
    value: function (callback, type, quality) {
      var binStr = atob( this.toDataURL(type, quality).split(',')[1] ),
          len = binStr.length,
          arr = new Uint8Array(len);

      for (var i=0; i<len; i++ ) {
        arr[i] = binStr.charCodeAt(i);
      }
      callback( new Blob( [arr], {type: type || 'image/png'} ) );
    }
  });
}

//场景
var scenes = {};
//控制条
// var bars = ['role','mask','scene','object'];
var bars = ['scene','object'];
//小物件
var objects = {};
//矩形框
var rects = [];
//当前操作小物件容器
var activeContainer = null;

var role = {};

var baseUrl = '../images/'

var angleScale = {
    angle: 0,
    scale: {
        x: 1,
        y: 1,
    }
}

// 获取两点的角度
function rotateToPoint(mx, my, px, py){
  var dist_Y = my - py;
  var dist_X = mx - px;
  var angle = Math.atan2(dist_Y,dist_X);
  return angle;
}

// 获取两个数之间的随机数
function getRandom(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 绘制虚线
function drawDash(x0, y0, x1, y1, linewidth) {
  var dashed = new PIXI.Graphics();
  dashed.lineStyle(1, 0x59e3e8, 1); // linewidth,color,alpha
  dashed.moveTo(0, 0);
  dashed.lineTo(linewidth, 0);
  dashed.moveTo(linewidth * 1.5, 0);
  dashed.lineTo(linewidth * 2.5, 0);
  var dashedtexture = dashed.generateCanvasTexture(1, 1);
  var linelength = Math.pow(Math.pow(x1 - x0, 2) + Math.pow(y1 - y0, 2), 0.5);
  var tilingSprite = new PIXI.TilingSprite(dashedtexture, linelength, linewidth);
  tilingSprite.x = x0;
  tilingSprite.y = y0;
  tilingSprite.rotation = angle(x0, y0, x1, y1) * Math.PI / 180;
  tilingSprite.pivot.set(linewidth / 2, linewidth / 2);
  return tilingSprite;
  function angle(x0, y0, x1, y1) {
    var diff_x = Math.abs(x1 - x0),
    diff_y = Math.abs(y1 - y0);
    var cita;
    if (x1 > x0) {
      if (y1 > y0) {
        cita = 360 * Math.atan(diff_y / diff_x) / (2 * Math.PI);
      } else {
        if (y1 < y0) {
          cita = -360 * Math.atan(diff_y / diff_x) / (2 * Math.PI);
        } else {
          cita = 0;
        }
      }
    } else {
      if (x1 < x0) {
        if (y1 > y0) {
          cita = 180 - 360 * Math.atan(diff_y / diff_x) / (2 * Math.PI);
        } else {
          if (y1 < y0) {
            cita = 180 + 360 * Math.atan(diff_y / diff_x) / (2 * Math.PI);
          } else {
            cita = 180;
          }
        }
      } else {
        if (y1 > y0) {
          cita = 90;
        } else {
          if (y1 < y0) {
            cita = -90;
          } else {
            cita = 0;
          }
        }
      }
    }
    return cita;
  }
}

// 绘制虚线矩形
function drawRect(x,y,width,height,linewidth){
  var rect = new PIXI.Container();

  var top = drawDash(x,y,x+width,y,linewidth); //top border
  var bottom = drawDash(x,y+height,x+width,y+height,linewidth);//bottom border
  var left = drawDash(x,y,x,y+height,linewidth); //left border
  var right = drawDash(x+width,y,x+width,y+height,linewidth); //right border

  rect.addChild(top);
  rect.addChild(bottom);
  rect.addChild(left);
  rect.addChild(right);

  return rect;
}

function onDragStart(event) {
  event.stopPropagation();
  this.data = event.data;
    this.diff = { x: event.data.global.x - this.x, y: event.data.global.y - this.y }
    this.dragging = true;
}

function onDragEnd() {
  this.alpha = 1;
  this.dragging = false;
  this.data = null;
}

function onDragMove(){
  if (this.dragging) {
    var newPosition = this.data.getLocalPosition(this.parent);
    var rotation = rotateToPoint( newPosition.x , newPosition.y, this.position.x, this.position.y) - Math.PI / 2;
    this.rotation = rotation
  }
}

function onObjectDragStart(event){
    this.diff = { x: event.data.global.x - this.x, y: event.data.global.y - this.y }
    this.data = event.data;
  // this.alpha = 0.5;
  this.dragging = true;
  clearRects();
  //显示虚线矩形框
  this.children[0].visible = true
  activeContainer = this;
}

function onObjectDragMove(){
  if (this.dragging) {
    var newPosition = this.data.getLocalPosition(this.parent);
    this.x = newPosition.x - this.diff.x;
    this.y = newPosition.y - this.diff.y;
  }
}

function openNewWindowShowImage(img) {
    const newWin = window.open('', '_blank')
    newWin.document.write(img.outerHTML)
    newWin.document.title = ''
    newWin.document.close()
}

var Toast = {
  show: function(text){
    this.hide();
    var tpl = `<div class="toast">${ text }</div>`
    $('body').append('<div class="overlay"></div>').append(tpl);
    $('body').find('.toast').show();
  },
  hide: function(){
    $('body').find('.overlay').remove();
    $('body').find('.toast').remove();
  },
  fail: function(text){
    var me = this;
    me.show(text);
    setTimeout(function(){
      me.hide();
    },1500)
  }
}


var Dialog = {
    show: function(imgSrc){
        this.hide();
        var tpl = `<div class="dialog"><img src="${imgSrc}"/><span onclick="Dialog.hide()">x</span><label>长按图片保存</label></div>`
        $('body').append('<div class="overlay"></div>').append(tpl);
        $('body').find('.dialog').show();
    },
    hide: function(){
        $('body').find('.overlay').remove();
        $('body').find('.dialog').remove();
    },
}
var ImageLoader = {
    show: function(imgSrc){
        this.hide();
        var tpl = `<div class="imageLoader"><img src="${imgSrc}"/></div>`
        $('body').append(tpl);
        $('body').find('.dialog').show();
    },
    hide: function(){
        $('body').find('.imageLoader').remove();
    },
}

//清除矩形框
function clearRects(){
  rects.forEach(function(item,index){
    item.visible = false
  });
}

//绘制场景
function drawScene(index){
  var url = baseUrl + "/scene"+index+".png"

  $.each(scenes,function(key,index){
    scenes[key].visible = false;
  })

  if(!scenes[url]){
    var scene = PIXI.Sprite.from(url);
    scene.width = app.screen.width;
    scene.height = app.screen.height+controlHeight;
    scene.interactive = true;
    scene.buttonMode = true;
    scene.zIndex = 100;
    scene.on('pointerdown', function(){
      clearRects();
    });

    app.stage.addChild(scene);
    scenes[url] = scene;
  }else{
    scenes[url].visible = true;
  }
  app.stage.updateLayersOrder();
}

//绘制角色
function drawRole(index) {
  var head_img = baseUrl + "/clothes"+index +"_head.png";
  var body_img = baseUrl + "/clothes"+ index +"_body.png";
  var arm_img = baseUrl + "/clothes"+ index +"_arm.png";
  var hand_img = baseUrl + "/clothes"+ index +"_hand.png";
  var leg_img = baseUrl + "/clothes"+ index +"_leg.png";
  var foot_img = baseUrl + "/clothes"+ index +"_foot.png";

  PIXI.Loader.shared
    .add(head_img)
    .add(body_img)
    .add(arm_img)
    .add(hand_img)
    .add(leg_img)
    .add(foot_img)
    .load(function(){
      var head = new PIXI.Sprite(
          PIXI.Loader.shared.resources[head_img].texture
      );
      var body = new PIXI.Sprite(
          PIXI.Loader.shared.resources[body_img].texture
      );
      var left_arm = new PIXI.Sprite(
          PIXI.Loader.shared.resources[arm_img].texture
      );
      var left_hand = new PIXI.Sprite(
          PIXI.Loader.shared.resources[hand_img].texture
      );
      var right_arm = new PIXI.Sprite(
          PIXI.Loader.shared.resources[arm_img].texture
      );
      var right_hand = new PIXI.Sprite(
          PIXI.Loader.shared.resources[hand_img].texture
      );
      var left_leg = new PIXI.Sprite(
          PIXI.Loader.shared.resources[leg_img].texture
      );
      var left_foot = new PIXI.Sprite(
          PIXI.Loader.shared.resources[foot_img].texture
      );
      var right_leg = new PIXI.Sprite(
          PIXI.Loader.shared.resources[leg_img].texture
      );
      var right_foot = new PIXI.Sprite(
          PIXI.Loader.shared.resources[foot_img].texture
      );

      role = {
        head: head,
        body: body,
        left_arm: left_arm,
        left_hand: left_hand,
        left_leg: left_leg,
        left_foot: left_foot,
        right_arm: right_arm,
        right_hand: right_hand,
        right_leg: right_leg,
        right_foot: right_foot
      }

      var main = new PIXI.Container();
      main.zIndex = 50;
      var left_arm_hand = new PIXI.Container();
      var left_leg_foot = new PIXI.Container();
      var right_arm_hand = new PIXI.Container();
      var right_leg_foot = new PIXI.Container();


      left_arm_hand.addChild(left_hand);
      left_arm_hand.addChild(left_arm);

      left_leg_foot.addChild(left_foot);
      left_leg_foot.addChild(left_leg);

      right_arm_hand.addChild(right_hand);
      right_arm_hand.addChild(right_arm);

      right_leg_foot.addChild(right_foot);
      right_leg_foot.addChild(right_leg);

      main.addChild(right_arm_hand);

      main.addChild(body);
      main.addChild(left_leg_foot);
      main.addChild(right_leg_foot);
      main.addChild(left_arm_hand);
      main.addChild(head);

      main.width = main.width/2;
      main.height = main.height/2;

      main.position.set(app.screen.width/2,(app.screen.height)/2-100);

      head.anchor.set(0.3,0.5);

      body.anchor.set(0.5);
      body.position.set(0,240);

      right_arm.anchor.set(0.5);
      right_arm.position.set(120,195);
      right_hand.anchor.set(0.5,0.1);
      right_hand.position.set(130,200);

      left_arm_hand.position.set(-70,140);
      left_arm_hand.pivot.set(25,20);
      left_hand.position.set(left_arm.width/2,105);
      left_hand.pivot.set(left_arm.width/2,left_arm.width/2);

      right_arm_hand.position.set(70,140);
      right_arm_hand.pivot.set(20,20);
      right_arm.position.set(0,0);
      right_hand.position.set(26,105);
      right_arm.anchor.set(0);
      right_hand.anchor.set(0.5,0.2);
      right_arm_hand.rotation = -0.2

      left_leg_foot.position.set(-40,380);
      left_leg_foot.pivot.set(20,20)
      left_leg.position.set(0,0);
      left_foot.position.set(25,105);
      left_foot.pivot.set(left_leg.width/2,left_leg.width/2)

      right_leg_foot.position.set(40,380);
      right_leg_foot.pivot.set(20,20)
      right_leg.position.set(0,0);
      right_foot.position.set(25,105);
      right_foot.pivot.set(right_leg.width/2,right_leg.width/2)

      left_hand.interactive = true;
      right_hand.interactive = true;
      left_foot.interactive = true;
      right_foot.interactive = true;
      left_leg.interactive = true;
      left_leg_foot.interactive = true;
      right_leg_foot.interactive = true;
      left_arm_hand.interactive = true;
      right_arm_hand.interactive = true;
      main.interactive = true;

      left_arm_hand.on('pointerdown', onDragStart)
          .on('pointerup', onDragEnd)
          .on('pointerupoutside', onDragEnd)
          .on('pointermove', onDragMove);

      right_arm_hand.on('pointerdown', onDragStart)
          .on('pointerup', onDragEnd)
          .on('pointerupoutside', onDragEnd)
          .on('pointermove', onDragMove);

      left_leg_foot.on('pointerdown', onDragStart)
          .on('pointerup', onDragEnd)
          .on('pointerupoutside', onDragEnd)
          .on('pointermove', onDragMove);

      right_leg_foot.on('pointerdown', onDragStart)
          .on('pointerup', onDragEnd)
          .on('pointerupoutside', onDragEnd)
          .on('pointermove', onDragMove);

      left_foot.on('pointerdown', onDragStart)
          .on('pointerup', onDragEnd)
          .on('pointerupoutside', onDragEnd)
          .on('pointermove', onDragMove);

      right_foot.on('pointerdown', onDragStart)
          .on('pointerup', onDragEnd)
          .on('pointerupoutside', onDragEnd)
          .on('pointermove', onDragMove);

      left_hand.on('pointerdown', onDragStart)
          .on('pointerup', onDragEnd)
          .on('pointerupoutside', onDragEnd)
          .on('pointermove', onDragMove);

      right_hand.on('pointerdown', onDragStart)
          .on('pointerup', onDragEnd)
          .on('pointerupoutside', onDragEnd)
          .on('pointermove', onDragMove);

      main.on('pointerdown', function(event){
            this.data = event.data;
            this.diff = { x: event.data.global.x - this.x, y: event.data.global.y - this.y }
            this.dragging = true;
            clearRects();
          })
          .on('pointerup', onDragEnd)
          .on('pointerupoutside', onDragEnd)
          .on('pointermove', function(event){
            if (this.dragging) {
              var newPosition = this.data.getLocalPosition(this.parent);
              this.x = newPosition.x - this.diff.x;
              this.y = newPosition.y - this.diff.y;
            }
          });

      app.stage.addChild(main);
  });
}

function setup(object){
    var positionX = positionY = getRandom(100,150);

    var container = new PIXI.Container();
    container.interactive = true;
    container.buttonMode = true;
    container.position.set(positionX,positionY);
    container.degrees = 0;
    container.zIndex = 20;

    object.width = object.width/2;
    object.height = object.height/2;


    var rect = drawRect(object.getGlobalPosition().x-10,object.getGlobalPosition().y-10,object.width+20,object.height+20,1)
    rect.interactive = true;
    rect.buttonMode = true;
    rect.visible = false;

    rects.push(rect);

    var actions = drawActions(object);

    rect.addChild(actions);
    container.addChild(rect);
    container.addChild(object);

    container.pivot.set(container.width/2,container.height/2);
    container.rotation = 0;
    actions.position.set(container.width+12,-12);

    container
        .on('pointerdown', onObjectDragStart)
        .on('pointerup', onDragEnd)
        .on('pointerupoutside', onDragEnd)
        .on('pointermove', onObjectDragMove)

    app.stage.addChild(container);
}

function drawObject(url) {
    var object = null;
    if(objects[url]){
        object = PIXI.Sprite.from(url);
        setup(object);
    }else{
        PIXI.Loader.shared
            .add(url)
            .load(function(){
                object = new PIXI.Sprite(
                    PIXI.Loader.shared.resources[url].texture
                );
                objects[url] = true;
                setup(object);
            })
    }
}

//绘制小物件
function drawMiniObject(index){
  clearRects();
  var url = baseUrl + "/object" + index + '.png';
  drawObject(url);
}
//绘制上传物件
function drawUploadObject(imgSrc) {
    clearRects();
    drawObject(imgSrc)
}

//绘制操作按钮
function drawActions(object){
  var container = new PIXI.Container();
  container.zIndex = 5;

  var close = PIXI.Sprite.from(baseUrl + "/icons/close.png");
  close.scale.set(0.7);
  close.position.set(0,-8);
  close.interactive = true;
  close.buttonMode = true;
  close.on('pointerdown', function(){
    app.stage.removeChild(activeContainer);
    container.visible = false;
  });

  var zoomin = PIXI.Sprite.from(baseUrl + "/icons/zoomin.png");
  zoomin.scale.set(0.8);
  zoomin.position.set(0,15);
  zoomin.interactive = true;
  zoomin.buttonMode = true;
  zoomin.on('pointerdown', function(){
    activeContainer.scale.x *= 1.25;
    activeContainer.scale.y *= 1.25;
  });

  var zoomout = PIXI.Sprite.from(baseUrl + "/icons/zoomout.png");
  zoomout.scale.set(0.8);
  zoomout.position.set(0,40);
  zoomout.interactive = true;
  zoomout.buttonMode = true;
  zoomout.on('pointerdown', function(){
    activeContainer.scale.x /= 1.25;
    activeContainer.scale.y /= 1.25;
  });

  var rotateright = PIXI.Sprite.from(baseUrl + "/icons/rotate-right.png");
  rotateright.scale.set(0.8);
  rotateright.position.set(0,65);
  rotateright.interactive = true;
  rotateright.buttonMode = true;
  rotateright
    .on('pointerdown', function(){
      activeContainer.degrees = activeContainer.degrees+10;
      activeContainer.rotation = activeContainer.degrees * Math.PI / 180;
    })

  var rotateleft = PIXI.Sprite.from(baseUrl + "/icons/rotate-left.png");
  rotateleft.scale.set(0.8);
  rotateleft.position.set(0,90);
  rotateleft.interactive = true;
  rotateleft.buttonMode = true;
  rotateleft
    .on('pointerdown', function(){
      activeContainer.degrees = activeContainer.degrees-10;
      activeContainer.rotation = activeContainer.degrees * Math.PI / 180;
    })
  container.addChild(close);
  container.addChild(zoomin);
  container.addChild(zoomout);
  container.addChild(rotateright);
  container.addChild(rotateleft);

  return container;
}

// 绘制面具
function drawMask(index){
  var url = baseUrl + "/mask" + index + '.png';
  var texture = PIXI.Texture.from(url);
  role.head.texture = texture;
}

// 绘制衣服
function drawClothes(index){
  role.body.texture = PIXI.Texture.from(baseUrl + '/clothes'+index+'_body.png');
  role.left_arm.texture = PIXI.Texture.from(baseUrl + '/clothes'+index+'_arm.png');
  role.left_hand.texture = PIXI.Texture.from(baseUrl + '/clothes'+index+'_hand.png');
  role.left_leg.texture = PIXI.Texture.from(baseUrl + '/clothes'+index+'_leg.png');
  role.left_foot.texture = PIXI.Texture.from(baseUrl + '/clothes'+index+'_foot.png');
  role.right_arm.texture = PIXI.Texture.from(baseUrl + '/clothes'+index+'_arm.png');
  role.right_hand.texture = PIXI.Texture.from(baseUrl + '/clothes'+index+'_hand.png');
  role.right_leg.texture = PIXI.Texture.from(baseUrl + '/clothes'+index+'_leg.png');
  role.right_foot.texture = PIXI.Texture.from(baseUrl + '/clothes'+index+'_foot.png');
}

function scrollIntoView(dom){
  dom.addClass('active').siblings().removeClass('active')
  dom[0].scrollIntoView({ block: "end", behavior: "smooth" })
}

function resize(number){
  app.renderer.resize(app.screen.width,app.screen.height+(number))
}

// 下载图片
function download(imgUrl) {
    if (window.navigator.msSaveOrOpenBlob) {
        var bstr = atob(imgUrl.split(',')[1])
        var n = bstr.length
        var u8arr = new Uint8Array(n)
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n)
        }
        var blob = new Blob([u8arr])
        window.navigator.msSaveOrOpenBlob(blob, 'chart-download' + '.' + 'png')
    } else {
        // 这里就按照chrome等新版浏览器来处理
        const a = document.createElement('a')
        a.href = imgUrl
        a.setAttribute('download', +new Date() + "")
        a.click()
    }
}


// h5 file reader
function getBase64( thisFiles ) {
    return new Promise((resolve, reject) => {
        var reader = new FileReader();
        reader.readAsDataURL( thisFiles );
        reader.onload = function(e){
            const base64 = this.result;
            var img = new Image();
            img.onload = function(){
                resolve({
                    url: base64,
                    height: img.height,
                    width: img.width
                })
            };
            img.src = base64
        }
    })
};

$(function(){

  drawScene(1);
  drawMiniObject(1);
    // drawRole(1);

  $('.js-control-bar').on('click','li',function(){
    var index = $(this).index();
    var bar = bars[index];
    $('.js-control-list .control-item').hide();
    $('.js-control-list .control-'+bar).show();
    scrollIntoView($(this));
    $('.js-control-action').css('bottom','80px')
  });

  $('.js-control-role').on('click','li',function(){
    scrollIntoView($(this));
    var index = $(this).index() + 1;
    drawClothes(index);
  });

  $('.js-control-mask').on('click','li',function(){
    scrollIntoView($(this));
    var index = $(this).index() + 1;
    drawMask(index);
  });

  $('.js-control-object').on('click','li',function(){
    scrollIntoView($(this));
    var index = $(this).index() + 1;
    drawMiniObject(index);
  });

  $('.js-control-scene').on('click','li',function(){
    scrollIntoView($(this));
    var index = $(this).index() + 1;
    drawScene(index);
  });

  $('.js-control-save').on('click',function(){
    clearRects();
    setTimeout(function(){
      var image = app.view.toDataURL('image/png');
      // download(image)
      Dialog.show(image);
    },100)
  });
  $('.js-control-upload').on('click', function () {
      clearRects();
  })
  $('.js-control-upload>input').on('change', async (event) => {
      const file = event.currentTarget.files[0];
      if( !file.name.match(/.jpg|.jpeg|.gif|.png|.bmp/i) ){
          Toast.fail('上传图片的格式不正确，请重新选择~')
      } else {
          const {url, width, height} = await getBase64( file );

          var coolTexture = PIXI.Sprite.from(url);
          const MAX_SIZE = 200;
          if (width > height) {
              coolTexture.width = MAX_SIZE;
              coolTexture.height = height * MAX_SIZE / width;
          } else {
              coolTexture.height = MAX_SIZE;
              coolTexture.width = width * MAX_SIZE / height;
          }
          setup(coolTexture);
          // openNewWindowShowImage(image);
          // drawUploadObject(imgSrc)
      }
  })
});
