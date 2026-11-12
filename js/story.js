/* Story: naskah kampanye "Pulau Bekicot" — data murni + aturan progres.
   Tidak menyentuh Three/DOM. Dipentaskan oleh js/cutscene.js, dipanggil dari js/game.js.

   Bentuk adegan:
     { id, music, stage, title:{kicker,title,sub}, cast:[{who,at,a,r,face,hidden}], steps:[...] }
   Bentuk langkah:
     { who, text, cam:{at,angle,dist,h,look,orbit}, fx:'nama', show:['who'], hide:['who'],
       move:{who,a,r,t}, hop:'who', sound:'trophy' }
   `at`: gem | door | blimp | player | rival | portal:<trackId> | garage
   `angle`/`a` relatif terhadap arah hadap anchor (0 = tepat di depannya). */
(function(){
  // --- Pemeran. char: id roster BK.Characters; npc: palet khusus lewat BK.buildSnail ---
  const CAST = {
    player:  { name:'Kamu', player:true, emoji:'🐌', pitch:1.0 },
    tetua:   { name:'Tetua Cangkang', emoji:'🐚', pitch:0.72, scale:1.05,
               npc:{ id:'tetua', name:'Tetua', body:0xbfc7a8, head:0xd2d8bd, shellBase:'#8b8778', shellStripe:'#c9c2a8',
                     board:0x6e6252, flame:0x8ad9ff, boostCol:0x8ad9ff, scale:1.05 } },
    pipi:    { name:'Pipi si Mekanik', emoji:'🔧', pitch:1.45, scale:0.86,
               npc:{ id:'pipi', name:'Pipi', body:0xff9ec7, head:0xffb7d6, shellBase:'#ffcf3f', shellStripe:'#ff7aa8',
                     board:0x4a78c8, flame:0xffcf3f, boostCol:0xffcf3f, scale:0.86 } },
    juara:   { name:'Raja Juara', char:'juara', emoji:'👑', pitch:0.85 },
    balnok:  { name:'Kapten Balnok', char:'balnok', emoji:'🏴‍☠️', pitch:0.95 },
    spora:   { name:'Ratu Spora', char:'spora', emoji:'🍄', pitch:1.25 },
    krambil: { name:'Krambil', char:'krambil', emoji:'🥥', pitch:1.15 },
    bara:    { name:'Jenderal Bara', char:'bara', emoji:'🌋', pitch:0.62 },
    warga:   { name:'Warga Pulau', char:'besi', emoji:'🐌', pitch:1.05 },
    lumi:    { name:'Lumi', char:'hantu', emoji:'👻', pitch:1.3 },
    gesit:   { name:'Gesit', char:'turbo', emoji:'🔥', pitch:1.2 },
    pakoli:  { name:'Pak Oli', char:'besi', emoji:'🛢️', pitch:0.8 }
  };

  const CHAPTERS = [
    {
      n:1, id:'pantai', trackId:'pantai', rival:'balnok', biome:'beach',
      title:'Pasang yang Hilang', place:'Pantai Bekicot', unlock:'balnok',
      goal:'Kalahkan Kapten Balnok di Pantai Bekicot',
      summary:'Air laut menyusut sejak Permata pecah. Kapten Balnok menjaga kepingan pertama, demi janji Raja Juara mengapungkan kapalnya yang kandas.',
      rivals:['Lumi','Gesit']
    },
    {
      n:2, id:'hutan', trackId:'hutan', rival:'spora', biome:'ruins',
      title:'Rimba yang Layu', place:'Rimba Jamur', unlock:'spora',
      goal:'Kalahkan Ratu Spora di Rimba Jamur',
      summary:'Jamur-jamur raksasa mulai layu. Ratu Spora rela bersekutu dengan Raja Juara demi menyelamatkan rimbanya, lalu membongkar bahwa sang Raja dulu murid Tetua.',
      rivals:['Lumi','Pak Oli']
    },
    {
      n:3, id:'salju', trackId:'salju', rival:'krambil', biome:'glacier',
      title:'Kelapa di Puncak Salju', place:'Puncak Salju', unlock:'krambil',
      goal:'Kalahkan Krambil di Puncak Salju',
      summary:'Krambil, petualang kelapa yang tersesat, menjaga kepingan ketiga hanya demi bahan bakar penghangat. Ia mendengar gemuruh aneh dari Kawah.',
      rivals:['Gesit','Pak Oli']
    },
    {
      n:4, id:'kawah', trackId:'kawah', rival:'bara', biome:'citadel',
      title:'Sumpah Jenderal Bara', place:'Kawah Panas', unlock:'bara',
      goal:'Kalahkan Jenderal Bara di Kawah Panas',
      summary:'Jenderal Bara menepati sumpah setianya sampai kalah. Ia mengungkap rahasia: Raja Juara menyedot panas gunung, dan Tetua pernah mendiskualifikasinya bertahun lalu.',
      rivals:['Gesit','Lumi']
    }
  ];

  const S = {}; // id -> adegan

  // ===== PROLOG =====
  S.prologue = {
    id:'prologue', music:'menu', stage:5,
    title:{ kicker:'PROLOG', title:'Festival Permata', sub:'Pulau Bekicot, hari balap tahunan' },
    cast:[
      {who:'tetua',  at:'gem', a:-0.42, r:19, face:'in'},
      {who:'pipi',   at:'gem', a:0.42,  r:19, face:'in'},
      {who:'player', at:'gem', a:0,     r:23, face:'in'},
      {who:'juara',  at:'gem', a:0,     r:11, face:'out', hidden:true}
    ],
    steps:[
      { who:'tetua', cam:{at:'gem',angle:0.35,dist:34,h:11,look:9,orbit:0.03},
        text:'Setiap tahun, seluruh pulau berkumpul di <b>Lembah Permata</b>. Selama Permata Agung bersinar, ombak tetap pasang, jamur tetap tumbuh, dan gunung tetap tidur.' },
      { who:'pipi', cam:{at:'player',angle:0.5,dist:6.5,h:2.6,look:1.2},
        text:'Nah, itu dia! Balapan pembuka hampir mulai dan kamu baru sampai. Bekicot terlambat di festival bekicot. Klasik.' },
      { who:'tetua', cam:{at:'tetua',angle:0.3,dist:6,h:2.4,look:1.3},
        text:'Biarkan saja, Pipi. Yang datang paling akhir sering paling lama bertahan di lintasan. Eh, suara apa itu?', sound:'warp' },
      { who:'juara', cam:{at:'blimp',angle:0.7,dist:44,h:-6,look:0,orbit:0.02},
        text:'Tes, tes. Warga Pulau Bekicot! Tiga tahun berturut-turut aku juara dua. <b>Tiga tahun!</b> Hari ini kita ganti aturannya.' },
      { who:'juara', cam:{at:'gem',angle:0.0,dist:26,h:6,look:5}, show:['juara'], hop:'juara', fx:'juaraArrive',
        text:'Mulai sekarang aku <b>Raja Juara</b>. Festival dibatalkan, dan Permata ini ikut denganku.' },
      { who:'juara', cam:{at:'gem',angle:-0.5,dist:30,h:13,look:12}, fx:'shatter', sound:'hit',
        text:'Ups, pecah jadi empat! Tak apa. Tiap kepingan kusegel dalam <b>Piala Emas</b>, dan keempat panglimaku yang menjaganya.' },
      { who:'tetua', cam:{at:'tetua',angle:-0.4,dist:6,h:2.2,look:1.2},
        text:'Lihat langit itu. Tanpa Permata, pulau ini pelan-pelan padam. Juara! Dengar dulu!' },
      { who:'juara', cam:{at:'door',angle:0.2,dist:24,h:7,look:6}, hide:['juara'], fx:'juaraLeave',
        text:'Mau protes? Silakan balapan. Empat piala membuka <b>Gerbang Utara</b> ini. Aku tunggu di baliknya, kalau bekicot selambat kalian sampai.' },
      { who:'pipi', cam:{at:'pipi',angle:0.25,dist:5.5,h:2,look:1},
        text:'Dia kabur! Tetua, semua pembalap senior sudah lari. Tinggal... eh. Tinggal kamu, yang baru datang.' },
      { who:'tetua', cam:{at:'player',angle:-0.5,dist:7,h:3,look:1.2},
        text:'Kalau begitu kamu yang berangkat. Mulai dari <b>Pantai Bekicot</b>. Panah emas di atas kartmu akan menunjukkan jalan.' },
      { who:'pipi', cam:{at:'pipi',angle:-0.3,dist:5.5,h:2,look:1},
        text:'Tahan <b>Spasi</b> saat menikung untuk drift, lepas saat apinya ungu. Kalau kartmu rusak, garasiku ada di dekat sini. Jangan bikin malu, ya!' }
    ]
  };

  // ===== BAB 1: PANTAI =====
  S.pantai_pre = {
    id:'pantai_pre', music:'hub',
    title:{ kicker:'BAB 1', title:'Pasang yang Hilang', sub:'Pantai Bekicot' },
    steps:[
      { who:'balnok', cam:{at:'rival',angle:0.35,dist:6.5,h:2.2,look:1.1},
        text:'Ahoy, cangkang mungil! Lihat kapalku? Kandas sejak air surut. Raja Juara berjanji mengembalikan pasang, asal kepingan ini kujaga.' },
      { who:'balnok', cam:{at:'rival',angle:-0.45,dist:5.5,h:1.8,look:1.1}, hop:'rival',
        text:'Tiga putaran, juara satu bawa pulang piala. Tak ada yang pernah menyalipku di pasir ini!' },
      { who:'pipi', cam:{at:'player',angle:0.5,dist:6.5,h:2.6,look:1.2},
        text:'<i>(lewat radio)</i> Tips! Tahan <b>gas tepat saat angka 1</b> untuk start boost. Kotak biru memberimu item, tekan <b>E</b> untuk memakainya.' }
    ]
  };
  S.pantai_post = {
    id:'pantai_post', music:'finish',
    steps:[
      { who:'balnok', cam:{at:'rival',angle:0.4,dist:6,h:2,look:1.1},
        text:'Tersalip di pantai sendiri, ha! Ambillah pialanya. Aku kalah adil, dan bajak laut pun punya harga diri.' },
      { who:'balnok', cam:{at:'player',angle:0.6,dist:6.5,h:2.5,look:1.2},
        text:'Tapi dengar, Kecil: air tidak surut sendiri. Tiap malam kapal udara Raja melintas, dan pasang ikut tersedot. Kartku boleh kaupakai. Ingat, aku yang utang, bukan sebaliknya.' }
    ]
  };
  S.pantai_hub = {
    id:'pantai_hub', music:'hub', stage:0,
    steps:[
      { who:'tetua', cam:{at:'gem',angle:0.5,dist:30,h:13,look:11}, fx:'shardReturn', sound:'trophy',
        text:'Kepingan pertama kembali! Rasakan? Langit sedikit lebih terang. Dan pasang di teluk mulai naik.' },
      { who:'tetua', cam:{at:'portal:hutan',angle:0.25,dist:24,h:8,look:4}, fx:'portalReveal:hutan',
        text:'Portal <b>Rimba Jamur</b> sudah menyala. Hati-hati dengan Ratu Spora. Dia tidak jahat, tapi dia sedang putus asa, dan itu lebih berbahaya.' }
    ]
  };

  // ===== BAB 2: RIMBA =====
  S.hutan_pre = {
    id:'hutan_pre', music:'hub',
    title:{ kicker:'BAB 2', title:'Rimba yang Layu', sub:'Rimba Jamur' },
    steps:[
      { who:'spora', cam:{at:'rival',angle:0.35,dist:6.5,h:2.2,look:1.1},
        text:'Pelan-pelan, Tamu. Dengar rimba ini? Tidak ada suara. Jamur tertuaku layu dalam tiga hari setelah Permata pecah.' },
      { who:'spora', cam:{at:'rival',angle:-0.4,dist:5.5,h:1.8,look:1.1},
        text:'Raja Juara memberiku secuil cahaya kepingan untuk menjaga mereka tetap hidup. Kalau kuserahkan padamu, siapa yang menolong rimbaku?' },
      { who:'spora', cam:{at:'player',angle:0.55,dist:6.5,h:2.6,look:1.2}, hop:'rival',
        text:'Jalan tanah ini milikku. Coba rebut kalau bisa, dan jangan salahkan aku kalau akar-akarnya tak bersahabat.' }
    ]
  };
  S.hutan_post = {
    id:'hutan_post', music:'finish',
    steps:[
      { who:'spora', cam:{at:'rival',angle:0.4,dist:6,h:2,look:1.1},
        text:'Hmm. Kamu tidak berhenti walau tahu alasanku. Mungkin memang begitu cara menolong: pulihkan semuanya, bukan secuil.' },
      { who:'spora', cam:{at:'rival',angle:-0.5,dist:5.5,h:1.9,look:1.1},
        text:'Satu hal lagi. Tanya Tetua-mu siapa yang mengajari Juara mengebut. Rimba punya ingatan panjang, dan ia ingat seorang murid kecil berkart emas.' }
    ]
  };
  S.hutan_hub = {
    id:'hutan_hub', music:'hub', stage:1,
    steps:[
      { who:'tetua', cam:{at:'gem',angle:-0.5,dist:30,h:13,look:11}, fx:'shardReturn', sound:'trophy',
        text:'Dua kepingan. Jamur di barat mulai bertunas lagi...' },
      { who:'pipi', cam:{at:'pipi',angle:0.3,dist:5.5,h:2,look:1}, cast:[{who:'pipi',at:'gem',a:0.4,r:19,face:'in'}],
        text:'Tetua, Ratu Spora bilang Juara itu dulu muridmu. Betul? Kok Tetua diam? Tetua?' },
      { who:'tetua', cam:{at:'portal:salju',angle:0.25,dist:24,h:8,look:4}, fx:'portalReveal:salju',
        text:'...Nanti, Pipi. Sekarang <b>Puncak Salju</b> sudah terbuka. Pakai ban yang bagus, esnya licin dan penjaganya lebih licin lagi.' }
    ]
  };

  // ===== BAB 3: SALJU =====
  S.salju_pre = {
    id:'salju_pre', music:'hub',
    title:{ kicker:'BAB 3', title:'Kelapa di Puncak Salju', sub:'Puncak Salju' },
    steps:[
      { who:'krambil', cam:{at:'rival',angle:0.35,dist:6.5,h:2.2,look:1.1},
        text:'Br-br-brrr! Halo! Kamu bawa selimut? Aku Krambil. Aku kelapa. Kelapa tidak seharusnya berada di ketinggian ini.' },
      { who:'krambil', cam:{at:'rival',angle:-0.4,dist:5.5,h:1.8,look:1.1}, hop:'rival',
        text:'Salah belok di pelabuhan, tiga tahun lalu. Raja Juara menawariku bahan bakar penghangat kalau kujaga kepingan ini. Jadi maaf ya, aku harus menang!' },
      { who:'pipi', cam:{at:'player',angle:0.55,dist:6.5,h:2.6,look:1.2},
        text:'<i>(lewat radio)</i> Awas zona es biru: licin, tapi drift di atasnya mengisi boost dua kali lebih cepat. Pakai itu!' }
    ]
  };
  S.salju_post = {
    id:'salju_post', music:'finish',
    steps:[
      { who:'krambil', cam:{at:'rival',angle:0.4,dist:6,h:2,look:1.1},
        text:'Kalah, dan masih kedinginan. Hari yang lengkap. Nih, pialanya. Bagaimana cara turun dari gunung ini, omong-omong?' },
      { who:'krambil', cam:{at:'player',angle:0.6,dist:6.5,h:2.5,look:1.2},
        text:'Oh, dan satu hal. Dari atas sini aku dengar <b>gemuruh di Kawah</b>, makin keras tiap malam. Padahal gunung itu harusnya tidur. Aneh, kan?' }
    ]
  };
  S.salju_hub = {
    id:'salju_hub', music:'hub', stage:2,
    steps:[
      { who:'tetua', cam:{at:'gem',angle:0.5,dist:30,h:13,look:11}, fx:'shardReturn', sound:'trophy',
        text:'Tiga kepingan. Tinggal satu, dan yang terakhir ada di tangan yang paling keras kepala.' },
      { who:'tetua', cam:{at:'portal:kawah',angle:0.25,dist:24,h:8,look:4}, fx:'portalReveal:kawah',
        text:'<b>Kawah Panas</b>. Jenderal Bara dulu pengawal festival, sebelum bersumpah setia pada Juara. Ia akan menepati sumpah itu sampai akhir. Hormati dia, lalu kalahkan dia.' }
    ]
  };

  // ===== BAB 4: KAWAH =====
  S.kawah_pre = {
    id:'kawah_pre', music:'final',
    title:{ kicker:'BAB 4', title:'Sumpah Jenderal Bara', sub:'Kawah Panas' },
    steps:[
      { who:'bara', cam:{at:'rival',angle:0.35,dist:6.5,h:2,look:1.1},
        text:'Kau sudah sampai sejauh ini. Bagus. Aku tidak akan mengejekmu, Pembalap. Aku hanya akan mengalahkanmu.' },
      { who:'bara', cam:{at:'rival',angle:-0.45,dist:5.5,h:1.7,look:1.1}, hop:'rival',
        text:'Aku bersumpah setia, dan sumpah tidak punya gigi mundur. Kalau kau ingin kepingan ini, lewati aku di atas lava.' }
    ]
  };
  S.kawah_post = {
    id:'kawah_post', music:'finish',
    steps:[
      { who:'bara', cam:{at:'rival',angle:0.4,dist:6,h:2,look:1.1},
        text:'Sumpahku berakhir di garis finis ini. Terimalah pialanya, dan sekarang aku bebas bicara: Juara menyedot panas gunung untuk kapal udaranya.' },
      { who:'bara', cam:{at:'rival',angle:-0.5,dist:5.5,h:1.8,look:1.1},
        text:'Kalau terus begini, gunung ini meletus. Dia tahu, dan dia tak peduli lagi.' },
      { who:'bara', cam:{at:'player',angle:0.6,dist:6.5,h:2.5,look:1.2},
        text:'Tanya Tetua-mu tentang <b>Festival Dua Belas</b>. Di sanalah semua ini dimulai.' }
    ]
  };
  S.kawah_hub = {
    id:'kawah_hub', music:'hub', stage:3,
    steps:[
      { who:'tetua', cam:{at:'gem',angle:-0.5,dist:30,h:13,look:11}, fx:'shardReturn', sound:'trophy',
        text:'Empat kepingan. Pulau ini bernapas lagi, tapi Permata belum utuh selama Juara memegang intinya.' },
      { who:'pipi', cam:{at:'pipi',angle:0.3,dist:5.5,h:2,look:1}, cast:[{who:'pipi',at:'gem',a:0.4,r:19,face:'in'}],
        text:'Tetua. Festival Dua Belas. Jenderal Bara menyebutnya. Sekarang Tetua harus cerita.' },
      { who:'tetua', cam:{at:'tetua',angle:0.3,dist:6,h:2.3,look:1.3}, cast:[{who:'tetua',at:'gem',a:-0.4,r:19,face:'in'}],
        text:'Juara muridku yang terbaik. Di Festival Dua Belas dia menang, juara satu, untuk pertama kalinya. Lalu kudiskualifikasi. Kartnya kurang berat dua kilo.' },
      { who:'tetua', cam:{at:'tetua',angle:-0.35,dist:5.5,h:2,look:1.2},
        text:'Aturan tetaplah aturan, begitu kataku. Padahal timbangannya yang rusak. Aku tahu setelah upacara selesai, dan aku tak pernah bilang padanya.' },
      { who:'pipi', cam:{at:'pipi',angle:-0.3,dist:5.5,h:2,look:1},
        text:'...Selama ini dia selalu juara dua karena itu? Dia tak pernah percaya menang lagi, ya?' },
      { who:'tetua', cam:{at:'door',angle:0.2,dist:26,h:8,look:6}, fx:'gateOpen', sound:'keyFanfare',
        text:'<b>Gerbang Utara</b> terbuka. Kalahkan dia. Bukan untuk menghukumnya. Dia hanya perlu satu balapan yang benar-benar adil.' }
    ]
  };

  // ===== FINAL =====
  S.boss_pre = {
    id:'boss_pre', music:'final',
    title:{ kicker:'BAB TERAKHIR', title:'Mahkota Kawah', sub:'Duel melawan Raja Juara' },
    steps:[
      { who:'juara', cam:{at:'rival',angle:0.35,dist:7,h:2.4,look:1.2},
        text:'Empat piala! Tak kusangka. Selamat datang di <b>Mahkota Kawah</b>, sirkuit yang kubangun di atas gunung yang sedang bangun.' },
      { who:'juara', cam:{at:'rival',angle:-0.45,dist:6,h:2,look:1.2}, hop:'rival',
        text:'Aturannya sederhana, aturanku: aku akan menebar minyak dan menembakmu. Tiap putaran aku makin cepat. Tak ada yang bisa mendiskualifikasiku di sini!' },
      { who:'pipi', cam:{at:'player',angle:0.55,dist:6.5,h:2.6,look:1.2},
        text:'<i>(lewat radio)</i> Dia juga dipengaruhi hukum balapan yang sama! Hemat <b>perisai</b> untuk misilnya, ambil garis dalam, dan jangan pernah berhenti drift. Kamu pasti bisa!' }
    ]
  };
  S.boss_post = {
    id:'boss_post', music:'finish',
    steps:[
      { who:'juara', cam:{at:'rival',angle:0.4,dist:6.5,h:2.2,look:1.2},
        text:'Tidak... aku di belakang lagi? Lagi-lagi juara dua? Tak ada yang main curang? Timbangannya bagaimana?' },
      { who:'tetua', cam:{at:'player',angle:0.55,dist:7,h:2.8,look:1.2},
        text:'<i>(lewat radio)</i> Timbangannya rusak, Nak. Waktu itu. Kau menang di Festival Dua Belas, dan aku pengecut karena tak pernah mengakuinya. Maafkan aku.' },
      { who:'juara', cam:{at:'rival',angle:-0.4,dist:5.5,h:1.9,look:1.2},
        text:'...Selama ini? Aku menang, selama ini? Aku... hampir meledakkan seluruh pulau, gara-gara dua kilo.' },
      { who:'juara', cam:{at:'rival',angle:0.25,dist:5,h:1.6,look:1.2}, sound:'keyFanfare',
        text:'Ini inti Permatanya. Bawalah pulang sebelum gunungnya marah. Dan kamu, Lambat, tadi itu balapan terbaik yang pernah kujalani.' }
    ]
  };
  S.finale = {
    id:'finale', music:'menu', stage:4,
    title:{ kicker:'EPILOG', title:'Permata Utuh Kembali', sub:'' },
    cast:[
      {who:'tetua',   at:'gem', a:-0.5,  r:18, face:'in'},
      {who:'pipi',    at:'gem', a:0.5,   r:18, face:'in'},
      {who:'player',  at:'gem', a:0,     r:17, face:'in'},
      {who:'juara',   at:'gem', a:0.22,  r:24, face:'in'},
      {who:'balnok',  at:'gem', a:-0.26, r:25, face:'in'},
      {who:'spora',   at:'gem', a:-0.72, r:24, face:'in'},
      {who:'krambil', at:'gem', a:0.72,  r:24, face:'in'},
      {who:'bara',    at:'gem', a:1.02,  r:21, face:'in'}
    ],
    steps:[
      { who:'tetua', cam:{at:'gem',angle:0.3,dist:32,h:12,look:12,orbit:0.04}, fx:'gemWhole', sound:'keyFanfare',
        text:'Lihatlah. Permata Agung utuh kembali. Gunung tertidur, pasang naik, dan rimba berbunga lagi.' },
      { who:'balnok', cam:{at:'balnok',angle:0.4,dist:6,h:2,look:1.2},
        text:'Kapalku mengapung! Yah, sedikit. Miring, tapi mengapung. Hari yang baik untuk jadi bajak laut!' },
      { who:'krambil', cam:{at:'krambil',angle:-0.3,dist:6,h:2,look:1.2},
        text:'Ada yang tahu arah ke pelabuhan? Tidak? Baiklah. Kelihatannya aku tinggal di sini saja.' },
      { who:'juara', cam:{at:'juara',angle:0.35,dist:6,h:2.2,look:1.2},
        text:'Tetua. Tahun depan, festival lagi? Timbangannya sudah diperbaiki, kan?' },
      { who:'tetua', cam:{at:'tetua',angle:0.3,dist:6,h:2.3,look:1.3}, hop:'tetua',
        text:'Sudah, Nak. Dan namamu kutulis di papan Festival Dua Belas, di tempat yang semestinya.' },
      { who:'pipi', cam:{at:'player',angle:0.5,dist:7,h:3,look:1.2}, fx:'fireworks',
        text:'Jadi, siapa yang mau balapan pembuka yang tertunda? Kamu terlambat setahun penuh, tahu. Ayo, pulaunya masih menyimpan banyak rekor untukmu!' }
    ]
  };
  S.legend = {
    id:'legend', music:'menu', stage:5,
    cast:[{who:'juara',at:'gem',a:0,r:18,face:'out'},{who:'tetua',at:'gem',a:-0.5,r:19,face:'in'}],
    title:{ kicker:'RAHASIA', title:'Legenda Pulau', sub:'100% tamat' },
    steps:[
      { who:'juara', cam:{at:'juara',angle:0.3,dist:7,h:2.5,look:1.3},
        text:'Semua token, semua relik. Bahkan aku tak pernah sampai sejauh itu. Hei, Lambat, bukan: <b>Legenda</b>.' },
      { who:'juara', cam:{at:'juara',angle:-0.35,dist:5.5,h:2,look:1.3}, sound:'keyFanfare', fx:'fireworks',
        text:'Mahkota ini berat dan kurang cocok buatku. Coba pakai jejak ungu ini saja. Lebih mencolok, dan timbangan pun tak akan protes.' },
      { who:'tetua', cam:{at:'gem',angle:0.3,dist:32,h:12,look:12,orbit:0.04},
        text:'Pulau ini sudah kaujelajahi sampai ke sudut terakhirnya. Terima kasih sudah datang, walau terlambat.' }
    ]
  };

  // --- Kalimat kalah (dipakai layar hasil + obrolan) ---
  const LOSE = {
    pantai:['Balnok: "Ombak pun lebih cepat darimu, Kecil! Coba lagi!"','Balnok: "Drift, Nak! Drift! Pasir ini tak akan menyalip dirinya sendiri."'],
    hutan:['Ratu Spora: "Akar-akarku bahkan belum serius. Silakan ulangi."','Ratu Spora: "Rimba itu sabar. Kamu boleh coba lagi."'],
    salju:['Krambil: "Aku menang?! Aku MENANG! ...kamu bawa selimut, tidak?"','Krambil: "Pakai zona es-nya! Eh, kenapa kuberi tahu?"'],
    kawah:['Jenderal Bara: "Bangkit. Ulangi. Aku akan menunggu."','Jenderal Bara: "Kau ragu di tikungan. Lava tidak pernah ragu."'],
    boss:['Raja Juara: "HAH! Juara satu! Rasanya... yah, enak sekali!"','Raja Juara: "Kalau kamu kalah terus, aku bosan. Ayo lagi!"']
  };

  // --- Celetukan selama balapan: panglima terasa hidup, bukan sekadar titik di minimap ---
  const BARK = {
    balnok:{ overtake:'Lewat buritanku, Kecil!', passed:'Hei! Kembali ke sini!', hit:'Meriam siapa itu?!', lastlap:'Putaran terakhir, angkat jangkar!' },
    spora:{ overtake:'Akar-akarku tahu jalan pintas.', passed:'Cepat juga, Tamu.', hit:'Beraninya di rimbaku!', lastlap:'Rimba memperhatikanmu.' },
    krambil:{ overtake:'Permisi, kelapa lewat!', passed:'Aduh, jangan cepat-cepat!', hit:'Batokku retak!', lastlap:'Hampir sampai ke selimut!' },
    bara:{ overtake:'Terlalu lambat.', passed:'Bagus. Begitu seharusnya.', hit:'Hanya itu?', lastlap:'Sekarang yang sesungguhnya.' },
    juara:{ overtake:'Ini baru namanya balapan!', passed:'Tidak! Tidak lagi!', hit:'Curang! Eh, sebentar, itu kan caraku.', lastlap:'Putaran terakhir! Lihat kecepatan seorang raja!', attackOil:'Hati-hati, licin!', attackMissile:'Terima salam dari istana!', phase2:'Pemanasan selesai!', phase3:'Sekarang aku serius!' }
  };

  // --- Warga pulau: kalimat mengikuti bab. Warden yang kalah pindah berjaga di portalnya. ---
  function npcLines(who){
    const c = BK.Save.trophyCount(), done = BK.Save.hasBossKey();
    const L = {
      tetua: done
        ? ['Festival tahun depan akan jadi yang terbaik.','Papan Festival Dua Belas sudah kutulis ulang. Terlambat, tapi benar.','Masih ada token dan relik yang tertinggal di portal-portal itu.']
        : c>=4 ? ['Gerbang Utara menunggumu.','Bukan untuk menghukumnya. Ingat itu.']
        : c>=2 ? ['Pipi bertanya terus soal masa lalu. Nanti saja, ya.','Tiap kepingan yang pulang membuat langit lebih terang.']
        : ['Ikuti panah emas di atas kartmu.','Tahan Spasi saat menikung, lepas saat apinya ungu.','Kuil Status menyimpan catatan perjalananmu.'],
      pipi: done
        ? ['Aku lagi merakit timbangan baru. Kali ini diuji dua kali!','Karakter baru? Ganti di garasi sini!']
        : ['Mau ganti pembalap? Tekan Enter di depan garasi.','Bekicot yang drift itu bekicot yang bahagia.','Koin di jalan bisa ditukar barang di Kuil Status.'],
      balnok:['Pasangnya mulai naik! Kapalku bergoyang sedikit!','Kalau menemukan dua belas ekor kepiting, jangan bilang siapa-siapa.','Portal ini masih menyimpan token dan relik. Coba kalau berani!'],
      spora:['Tunas baru tumbuh pagi ini. Terima kasih.','Rimba ini ingat siapa yang menolongnya.','Coba rebut token rimba. Jalan tanahnya suka mengejutkan.'],
      krambil:['Masih dingin. Tapi sekarang dingin yang penuh harapan.','Kamu tahu arah ke pelabuhan? Bukan? Ya sudah.','Kotak waktu itu seru, tapi membuat kepalaku pusing.'],
      bara:['Aku tidak berutang apa pun lagi pada siapa pun. Rasanya aneh.','Gunung sudah lebih tenang. Aku berjaga saja, kebiasaan.','Hormat untukmu, Pembalap.'],
      warga: done
        ? ['Festival! Akhirnya!','Aku selalu tahu kamu bisa. Sungguh. Aku tidak kabur, kok.']
        : c===0 ? ['Air laut surut, jamur layu... kamu pembalap baru itu? Tolong kami.','Semua pembalap senior lari saat Raja datang. Malu-maluin.']
        : ['Langitnya lebih terang hari ini!','Kudengar kamu mengalahkan seorang panglima. Sungguh?','Teruskan, Kecil. Seluruh pulau menontonmu.']
    };
    return L[who] || L.warga;
  }

  // --- Catatan Tetua: hadiah cerita untuk token & relik (setelah tamat jadi motivasi 100%) ---
  const LORE = [
    { key:'token_pantai', title:'Asal Permata', text:'Permata Agung bukan batu biasa: ia mengkristal dari lendir bekicot pertama yang mengelilingi pulau ini sampai jalannya berkilau.' },
    { key:'relic_pantai', title:'Kapal Balnok', text:'Balnok tak pernah berlayar jauh. Kapalnya kandas pada hari pertama, dan ia terlalu gengsi untuk mengakuinya.' },
    { key:'token_hutan',  title:'Bahasa Akar', text:'Ratu Spora sungguh bisa bicara dengan akar. Sebagian besar akar hanya mengeluh soal cuaca.' },
    { key:'relic_hutan',  title:'Murid Kecil', text:'Juara kecil datang ke rimba tiap pagi untuk berlatih drift. Ia selalu mengucapkan terima kasih pada jamur yang ditabraknya.' },
    { key:'token_salju',  title:'Peta Krambil', text:'Peta Krambil digambar terbalik sejak awal. Tak ada yang tega memberitahunya.' },
    { key:'relic_salju',  title:'Selimut', text:'Warga Puncak Salju pernah menyulam selimut raksasa untuk Krambil. Ia mengira itu layar kapal, lalu mencoba berlayar.' },
    { key:'token_kawah',  title:'Sumpah Bara', text:'Bara bersumpah setia pada hari Juara didiskualifikasi. Hanya ia yang datang menepuk bahunya. Hutang itu yang ia bayar.' },
    { key:'relic_kawah',  title:'Timbangan', text:'Timbangan Festival Dua Belas masih tersimpan di kuil. Baut kirinya longgar. Selisihnya tepat dua kilo.' }
  ];
  function loreOpen(k){
    const [kind,id]=k.split('_');
    return kind==='token'?BK.Save.hasToken(id):BK.Save.hasRelic(id);
  }

  const HUB_ORDER = ['prologue','pantai_hub','hutan_hub','salju_hub','kawah_hub','finale','legend'];
  function hubReady(id){
    const s=BK.Save;
    if(id==='prologue') return true;
    if(id==='finale') return s.hasBossKey();
    if(id==='legend') return s.getAdventurePct()>=100;
    const ch=id.replace('_hub','');
    return s.hasTrophy(ch);
  }

  BK.Story = {
    CAST, CHAPTERS, LORE, BARK,
    scene(id){ return S[id]||null; },
    // tahap cahaya pulau: 0 (padam) .. 4 (empat kepingan), 5 = Permata utuh
    storyStage(){ return BK.Save.hasBossKey()?5:BK.Save.trophyCount(); },
    chapter(trackId){ return CHAPTERS.find(c=>c.trackId===trackId)||null; },
    // bab aktif = bab pertama yang pialanya belum direbut; null bila keempatnya sudah
    current(){ return CHAPTERS.find(c=>!BK.Save.hasTrophy(c.trackId))||null; },
    chapterLabel(){
      const c=this.current();
      if(c) return 'BAB '+c.n+' · '+c.title;
      return BK.Save.hasBossKey()?(BK.Save.getAdventurePct()>=100?'LEGENDA PULAU':'SETELAH FESTIVAL'):'BAB TERAKHIR · Mahkota Kawah';
    },
    objective(){
      const c=this.current();
      if(c) return c.goal;
      if(!BK.Save.hasBossKey()) return 'Masuki Gerbang Utara dan kalahkan Raja Juara';
      return BK.Save.getAdventurePct()>=100?'Pulau ini milikmu. Jelajahi sesukamu':'Kumpulkan token & relik yang tersisa di portal';
    },
    // adegan pulau yang belum ditonton, berurutan; dihitung dari simpanan agar tahan reload
    pendingHubScenes(){ return HUB_ORDER.filter(id=>!BK.Save.sceneSeen(id)&&hubReady(id)); },
    preScene(trackId){ const c=this.chapter(trackId); return c?c.id+'_pre':null; },
    postScene(trackId){ const c=this.chapter(trackId); return c?c.id+'_post':null; },
    loseLine(key){ const a=LOSE[key]||LOSE.boss; return a[(BK.Save.lossCount(key)||0)%a.length]; },
    npcLines,
    // daftar penghuni pulau untuk dibangun di hub (x,z mutlak di peta)
    hubNpcs(){
      const s=BK.Save;
      const list=[
        {who:'tetua', x:-11,z:30, face:Math.PI*0.75},
        {who:'pipi',  x:24, z:44, face:-Math.PI*0.6},
        {who:'warga', x:-122,z:150, face:0.9},
        {who:'warga', x:-205,z:6, face:-1.6},
        {who:'warga', x:-98, z:-150, face:0.4},
        {who:'warga', x:170, z:-8, face:1.4}
      ];
      const spot={pantai:[-150,162],hutan:[-218,-6],salju:[-136,-160],kawah:[188,-18]};
      CHAPTERS.forEach(c=>{ if(s.hasTrophy(c.trackId)) list.push({who:c.rival,x:spot[c.trackId][0],z:spot[c.trackId][1],face:Math.atan2(-spot[c.trackId][0],-spot[c.trackId][1])}); });
      return list;
    },
    lore(){ return LORE.map(l=>({title:l.title,text:l.text,open:loreOpen(l.key)})); },
    journal(){
      const s=BK.Save, out=[];
      if(s.sceneSeen('prologue')) out.push({title:'Prolog · Festival Permata',text:'Raja Juara memecahkan Permata Agung menjadi empat kepingan dan menitipkannya pada empat panglima. Tanpa Permata, pulau ini perlahan padam. Kamu yang datang terlambat kini jadi harapan terakhir.'});
      CHAPTERS.forEach(c=>{ if(s.hasTrophy(c.trackId)) out.push({title:'Bab '+c.n+' · '+c.title,text:c.summary}); });
      if(s.hasBossKey()) out.push({title:'Bab Terakhir · Mahkota Kawah',text:'Kamu mengalahkan Juara dalam balapan yang benar-benar adil. Tetua mengakui kesalahannya di Festival Dua Belas. Permata utuh kembali, dan keempat panglima tinggal di pulau.'});
      const c=this.current();
      if(c) out.push({title:'Sekarang',text:c.goal+'.',now:true});
      else if(!s.hasBossKey()) out.push({title:'Sekarang',text:'Masuki Gerbang Utara dan kalahkan Raja Juara.',now:true});
      return out;
    },
    credits:[
      {h:'CRASH BEKICOT'},
      {p:'Kisah Pulau Bekicot'},
      {h:'Pemeran'},
      {p:'Kamu, yang datang terlambat'},
      {p:'Tetua Cangkang · Pipi si Mekanik'},
      {p:'Kapten Balnok · Ratu Spora'},
      {p:'Krambil · Jenderal Bara'},
      {p:'dan Raja Juara, sang juara Festival Dua Belas'},
      {h:'Terima Kasih Sudah Bermain'},
      {p:'Token dan Relik Waktu masih menunggu di tiap portal.'},
      {p:'Selesaikan 100% untuk adegan rahasia.'}
    ]
  };
})();
