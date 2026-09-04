# Zendo Groups

Chrome üçün brauzer genişlənməsi. Zendo.az saytındakı tapşırıqlar lövhəsində (kanban) tapşırıqları qruplaşdırmağa və akkordeon şəklində göstərməyə imkan verir.

## Nə edir

- Lövhədəki istənilən tapşırıqları seçib bir qrupa birləşdirmək olar.
- Hər qrup akkordeon kimi açılır və bağlanır, öz adı və rəngi olur.
- Qrupdakı tapşırıqlar vizual olaraq fərqlənir: kənara çəkilir və qrupun rəngində zolaqla işarələnir.
- Tapşırığı başqa sütundan sürükləyib qrupun yanına buraxdıqda o, avtomatik olaraq həmin qrupa əlavə olunur.
- Qruplar brauzerdə yadda saxlanılır və səhifə yenilənəndən sonra da qalır.
- Sürükleyib-buraxma (drag-and-drop) saytın öz funksiyası kimi işləməyə davam edir.

## Demo video

<video src="demo.webm" controls width="100%"></video>

## Chrome-da quraşdırma

1. Repozitorini yükləyin və ya klonlayın:
   ```bash
   git clone <repo-url>
   ```
2. Chrome-da `chrome://extensions` səhifəsini açın.
3. Sağ yuxarıda **Developer mode** (Tərtibatçı rejimi) seçimini aktiv edin.
4. **Load unpacked** düyməsini sıxın və `zendo-groups-extension` qovluğunu seçin.
5. Zendo.az saytını açın. Səhifənin sağ tərəfində dairəvi düymə görünəcək.

## İstifadə qaydası

1. Dairəvi düyməni sıxıb paneli açın.
2. **Tapşırıqları seç** düyməsini sıxın və qruplaşdırmaq istədiyiniz kartların üzərinə klikləyin (bu rejimdə kartın açılması bloklanır).
3. Qrup üçün ad yazın və **Qruplaşdır** düyməsini sıxın.
4. Qrup başlığına klikləməklə onu açıb-bağlamaq olar.
5. Paneldə qrupu yenidən adlandırmaq və ya qrupu ləğv etmək mümkündür.

## Qeydlər

- Qruplar yalnız sizin brauzerinizdə görünür və hər layihə üçün ayrıca saxlanılır.
- Genişlənmə saytın kodunu dəyişmir, yalnız görünüşü fərdiləşdirir.
