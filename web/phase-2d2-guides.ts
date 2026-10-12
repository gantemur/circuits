import type { Bilingual, GuideLesson } from './study-guide.js';

// Authored lessons describe the fixture, not a formula re-fitted after an edit.
const lesson = (en: GuideLesson, mn: GuideLesson): Bilingual => ({ en, mn });
export const phase2d2Lessons: Readonly<Record<string, Bilingual>> = {
  'rc3-low-pass': lesson(
    { question: 'Why do three connected RC sections differ from three isolated filters?',
      conditions: 'Vin is an ideal 1 V source; three equal 1 kΩ series resistors and shunt capacitors; output out–0 is unloaded; storage starts at zero.',
      equation: 'z=sRC; H(z)=1/(1+6z+5z²+z³). The complete circuit is −3 dB at 1 kHz; 1/(2πRC) is a different element break.',
      steps: [
        { text: 'In Frequency, inspect out at 1 kHz and compare the connected curve with [1/(1+z)]³.', action: 'frequency' },
        { text: 'In Transient, inspect out for 2 ms at 2 µs steps; then edit one capacitor.', action: 'transient' },
        { text: 'In the two-port panel, choose input (in,0), output (out,0), exclude Vin as external drive, and try a temporary 1 kΩ load. This is a different termination from the unloaded reference.', action: 'port-frequency' },
      ], compare: 'The next stage loads the previous one. Eventual −60 dB/decade roll-off does not alone predict rejection near the corner or step quality.' },
    { question: 'Холбогдсон гурван RC шат яагаад тусгаар гурван шүүлтүүрээс өөр вэ?',
      conditions: 'Vin идеал 1 V үүсгүүр; 1 кΩ-ийн гурван цуваа эсэргүүцэл, зангилаа бүрт конденсатор; out–0 ачаалалгүй; анхны хадгалалт тэг.',
      equation: 'z=sRC; H(z)=1/(1+6z+5z²+z³). Бүтэн хэлхээний −3 dB зааг 1 kHz; 1/(2πRC) нь тусдаа элементийн зааг.',
      steps: [
        { text: 'Давтамжийн самбарт 1 kHz-д out-г үзэж, холбогдсон муруйг [1/(1+z)]³-тай харьцуул.', action: 'frequency' },
        { text: 'Шилжилтийн самбарт out-г 2 ms хугацаанд 2 µs алхмаар үзээд нэг C-г өөрчил.', action: 'transient' },
        { text: 'Хоёр туйлын самбарт оролт (in,0), гаралт (out,0), гадаад хөтлөлтөөс Vin-ийг хасаж, түр 1 кΩ ачаалал сонго. Энэ нь ачаалалгүй лавлахаас өөр туршилт.', action: 'port-frequency' },
      ], compare: 'Дараагийн шат өмнөхөө ачаална. Алсын −60 dB/арван дахины налуу нь заагийн ойролцоох даралт эсвэл алхмын чанарыг дангаараа тодорхойлохгүй.' }),
  'rc3-high-pass': lesson(
    { question: 'How can a passive high-pass output jump while capacitor voltages stay continuous?',
      conditions: 'Ideal Vin 0→1 V step; three equal series capacitors and 1 kΩ shunts; no external output load; initial capacitor voltages zero.',
      equation: 'z=sRC; H(z)=z³/(1+5z+6z²+z³); the complete −3 dB point is 1 kHz.',
      steps: [
        { text: 'In Frequency, inspect out near 1 kHz and the +60 dB/decade low-frequency limit.', action: 'frequency' },
        { text: 'In Transient, inspect out at 0+ and later over 20 ms with 20 µs steps; look for sign changes.', action: 'transient' },
      ], compare: 'The initial output is 1 V and final DC output is zero. Node jumps need not violate continuity of voltage across each capacitor.' },
    { question: 'Конденсаторын хүчдэл тасралтгүй байхад өндөр нэвтрүүлэх гаралт яагаад үсэрдэг вэ?',
      conditions: 'Идеал Vin 0→1 V алхам; гурван цуваа C ба 1 кΩ шунт; гаднах ачаалалгүй; C бүрийн анхны хүчдэл тэг.',
      equation: 'z=sRC; H(z)=z³/(1+5z+6z²+z³); бүтэн хэлхээний −3 dB зааг 1 kHz.',
      steps: [
        { text: 'Давтамжийн самбарт out-г 1 kHz орчим болон нам давтамжийн +60 dB/арван дахины хязгаарт үз.', action: 'frequency' },
        { text: 'Шилжилтийн самбарт out-г 0+ агшин болон 20 ms турш 20 µs алхмаар үз; тэмдэг солигдохыг ажигла.', action: 'transient' },
      ], compare: 'Эхний гаралт 1 V, эцсийн DC гаралт тэг. Зангилааны үсрэлт нь C бүрийн хоёр үзүүрийн хүчдэлийн тасралтгүй чанарыг зөрчихгүй.' }),
  'butterworth2-low-pass': lesson(
    { question: 'What does a second-order Butterworth baseline trade for a flat passband?',
      conditions: 'Ideal powered unity VCVS senses b–0; Cf returns from out to a; RL=10 kΩ; Vin is 1 V; storage starts at zero.',
      equation: 'H(s)=1/[1+sCg(R1+R2)+s²R1R2CfCg]=1/(1+√2z+z²), z=s/(2π·1000), for baseline ratios.',
      steps: [
        { text: 'In Frequency, compare the 1 kHz corner and 2 kHz rejection with RC3 low-pass.', action: 'frequency' },
        { text: 'In Transient, inspect overshoot. Change a resistor or capacitor ratio and compare the live response with the fixed baseline target.', action: 'transient' },
        { text: 'Change RL from 10 kΩ to 1 kΩ; compare unchanged transfer and changed follower/load currents in DC.', action: 'dc' },
      ], compare: 'Butterworth flatness describes the baseline magnitude, not every edit or the best possible step. Follower gain changes the feedback network, not just the output scale.' },
    { question: 'Хоёрдугаар эрэмбийн Баттервортын суурь нь тэгш нэвтрүүлэх мужийн төлөө юуг сольдог вэ?',
      conditions: 'Идеал тэжээлтэй нэгж өсгөлттэй VCVS b–0-г мэдэрнэ; Cf out-оос a руу буцна; RL=10 кΩ; Vin=1 V; анхны хадгалалт тэг.',
      equation: 'Суурь харьцаанд H(s)=1/[1+sCg(R1+R2)+s²R1R2CfCg]=1/(1+√2z+z²), z=s/(2π·1000).',
      steps: [
        { text: 'Давтамжийн самбарт 1 kHz зааг ба 2 kHz даралтыг гурван шаттай RC-тэй харьцуул.', action: 'frequency' },
        { text: 'Шилжилтийн самбарт давалтын хэмжээг үз. R эсвэл C-ийн харьцааг өөрчилж одоогийн хариуг тогтмол суурь зорилттой харьцуул.', action: 'transient' },
        { text: 'RL-г 10 кΩ-оос 1 кΩ болго; дамжуулалт хэвээр, дагагч ба ачааллын гүйдэл өөрчлөгдөхийг DC-д харьцуул.', action: 'dc' },
      ], compare: 'Баттервортын тэгш байдал зөвхөн суурь далайцад хамаарна; алхмын хамгийн сайн хариу гэсэн үг биш. Дагагчийн өсгөлт буцах холбоог өөрчилнө.' }),
  'butterworth2-high-pass': lesson(
    { question: 'How does the active high-pass differ from the three-section passive ladder?',
      conditions: 'Two 10 nF series capacitors; Rf from a to the ideal follower output; Rg from b to ground; RL=10 kΩ; zero initial storage.',
      equation: 'H(s)=s²RfRgC1C2/[1+sRf(C1+C2)+s²RfRgC1C2]=z²/(1+√2z+z²), z=s/(2π·1000).',
      steps: [
        { text: 'In Frequency, compare 500 Hz and the 1 kHz corner with RC3 high-pass.', action: 'frequency' },
        { text: 'In Transient, inspect the initial jump and subsequent undershoot; change Rf/Rg to alter Q.', action: 'transient' },
        { text: 'Change RL and inspect load and follower currents; the ideal transfer stays the same.', action: 'dc' },
      ], compare: 'The +40 dB/decade far-low-frequency slope differs from the passive third-order ladder. Baseline ratios, feedback, and transient behavior matter separately.' },
    { question: 'Идэвхтэй өндөр нэвтрүүлэх шүүлтүүр гурван шаттай идэвхгүй сүлжээнээс юугаар ялгаатай вэ?',
      conditions: 'Хоёр 10 nF цуваа C; Rf нь a-гаас идеал дагагчийн гаралт руу, Rg нь b-гээс газарт; RL=10 кΩ; анхны хадгалалт тэг.',
      equation: 'H(s)=s²RfRgC1C2/[1+sRf(C1+C2)+s²RfRgC1C2]=z²/(1+√2z+z²), z=s/(2π·1000).',
      steps: [
        { text: 'Давтамжийн самбарт 500 Hz ба 1 kHz заагийг гурван шаттай RC өндөр нэвтрүүлэхтэй харьцуул.', action: 'frequency' },
        { text: 'Шилжилтийн самбарт эхний үсрэлт, дараах доош давалтыг үз; Rf/Rg-г өөрчилж Q-г өөрчил.', action: 'transient' },
        { text: 'RL-г өөрчилж ачаалал ба дагагчийн гүйдлийг үз; идеал дамжуулалт хэвээр.', action: 'dc' },
      ], compare: 'Нам давтамжийн алсын +40 dB/арван дахины налуу нь идэвхгүй гуравдугаар эрэмбээс өөр. Суурь харьцаа, буцах холбоо, шилжилт тусдаа чухал.' }),
  'rlc-band-pass': lesson(
    { question: 'Why can one series RLC circuit act as a band-pass?',
      conditions: 'Measure in–a across Rbp; R=100 Ω, L=0.01 H, C=1 µF; ideal 1 V input; no external load; zero initial storage.',
      equation: 'D=1+sRC+s²LC; Hband=sRC/D; ω0=10000 rad/s, Q=1, Δω=R/L.',
      steps: [
        { text: 'In Frequency, inspect resistorVoltage at f0≈1591.55 Hz, then select inductorVoltage or capacitorVoltage.', action: 'frequency' },
        { text: 'In Transient, inspect the decaying resistor-voltage step; change R to alter Q and bandwidth.', action: 'transient' },
        { text: 'Change the measured output to lcVoltage; compare it with the notch lesson without rewiring.', action: 'frequency' },
      ], compare: 'Band-pass names the measurement across R, not a cascade of separate low- and high-pass blocks. Other voltages share the same circuit.' },
    { question: 'Нэг цуваа RLC хэлхээ яагаад зурвас нэвтрүүлэх хариу өгдөг вэ?',
      conditions: 'Rbp дээрх in–a-г хэмжинэ; R=100 Ω, L=0.01 H, C=1 µF; идеал 1 V оролт; гаднах ачаалалгүй; анхны хадгалалт тэг.',
      equation: 'D=1+sRC+s²LC; Hband=sRC/D; ω0=10000 rad/s, Q=1, Δω=R/L.',
      steps: [
        { text: 'Давтамжийн самбарт resistorVoltage-г f0≈1591.55 Hz-д үзээд inductorVoltage эсвэл capacitorVoltage-г сонго.', action: 'frequency' },
        { text: 'Шилжилтийн самбарт R-ийн хүчдэлийн замхрах алхмыг үз; R-г өөрчилж Q ба зурвасын өргөнийг өөрчил.', action: 'transient' },
        { text: 'Хэмжих гаралтыг lcVoltage болгож, утас өөрчлөхгүйгээр зурвас хориглох жишээтэй харьцуул.', action: 'frequency' },
      ], compare: 'Зурвас нэвтрүүлэх гэдэг нь тус тусын хоёр шүүлтүүрийн цуваа биш, R дээрх хэмжилтийн сонголт. Бусад хүчдэл ижил хэлхээнд байна.' }),
  'rlc-notch': lesson(
    { question: 'How can the L+C voltage cancel at resonance?',
      conditions: 'Same physical series RLC as band-pass, with distinct native IDs; measure a–0 across Ln+Cn; zero initial storage.',
      equation: 'Hnotch=(1+s²LC)/(1+sRC+s²LC); Hband+Hnotch=1; ω0=10000 rad/s.',
      steps: [
        { text: 'In Frequency, inspect lcVoltage near f0≈1591.55 Hz; at the exact zero the phase is undefined.', action: 'frequency' },
        { text: 'Select resistorVoltage and compare with the band-pass output; vary L or C to move the ideal zero.', action: 'frequency' },
        { text: 'In Transient, compare the L+C step with one minus the resistor step; vary R for damping.', action: 'transient' },
      ], compare: 'An analytical zero need not plot as −Infinity dB: finite floating-point cancellation near the zero is sensitive to roundoff.' },
    { question: 'Резонансад L+C-ийн хүчдэл яаж цуцлагддаг вэ?',
      conditions: 'Зурвас нэвтрүүлэхтэй ижил цуваа RLC, ялгаатай үндсэн ID-тай; Ln+Cn дээрх a–0-г хэмжинэ; анхны хадгалалт тэг.',
      equation: 'Hnotch=(1+s²LC)/(1+sRC+s²LC); Hband+Hnotch=1; ω0=10000 rad/s.',
      steps: [
        { text: 'Давтамжийн самбарт lcVoltage-г f0≈1591.55 Hz орчим үз; яг тэг дээр фаз тодорхойгүй.', action: 'frequency' },
        { text: 'resistorVoltage-г сонгож зурвас нэвтрүүлэх гаралттай харьцуул; L эсвэл C-г өөрчилж тэг болох давтамжийг шилжүүл.', action: 'frequency' },
        { text: 'Шилжилтийн самбарт L+C-ийн алхмыг R-ийн алхмын нэгээс хассан утгатай харьцуул; R-г өөрчилж намдалтыг үз.', action: 'transient' },
      ], compare: 'Аналитик тэг нь графикт заавал −Infinity dB болохгүй: тэгийн ойролцоох тоон цуцлалт дугуйлалтын алдаанд мэдрэмтгий.' }),
  'rc-impedance-ladder': lesson(
    { question: 'How does a continued fraction encode a source-free RC ladder?',
      conditions: 'No permanent drive/load. Port (in,0); positive current enters at in. R=[1,2,3] kΩ; C=[1,0.5,0.25] µF.',
      equation: 'Z3=R3+1/(sC3); Z2=R2+1/(sC2+1/Z3); Z=R1+1/(sC1+1/Z2), s=i2πf.',
      steps: [
        { text: 'In one-port Frequency, select Z sweep 1 Hz–100 kHz and inspect 1 kHz.', action: 'port-frequency' },
        { text: 'At DC, inspect Y≈0 and the explicit unavailable finite Z; then change a shunt C.', action: 'port-frequency' },
      ], compare: 'Read the expression from the tail: series R, then shunt C. Z tends to R1 at high frequency; near DC sZ tends to 1/(C1+C2+C3). This is a driving-point Z, not an arbitrary transfer H synthesis.' },
    { question: 'Үүсгүүргүй RC шаталсан сүлжээг үргэлжилсэн бутархай хэрхэн илэрхийлэх вэ?',
      conditions: 'Байнгын хөтлөлт, ачаалалгүй. Туйл (in,0); эерэг гүйдэл in-д орно. R=[1,2,3] кΩ; C=[1,0.5,0.25] µF.',
      equation: 'Z3=R3+1/(sC3); Z2=R2+1/(sC2+1/Z3); Z=R1+1/(sC1+1/Z2), s=i2πf.',
      steps: [
        { text: 'Нэг туйлын давтамжийн самбарт Z-г 1 Hz–100 kHz-д тооцож, 1 kHz-г шалга.', action: 'port-frequency' },
        { text: 'DC-д Y≈0, төгсгөлөг Z байхгүй гэсэн ил үр дүнг үзээд нэг шунт C-г өөрчил.', action: 'port-frequency' },
      ], compare: 'Илэрхийллийг сүүлээс нь унш: цуваа R, дараа нь шунт C. Өндөр давтамжид Z→R1, DC орчимд sZ→1/(C1+C2+C3). Энэ нь оролтын Z бөгөөд дурын H-г нийлэгжүүлэх арга биш.' }),
  'rl-impedance-ladder': lesson(
    { question: 'What do series L and shunt R look like from the input port?',
      conditions: 'No permanent drive/load. Port (in,0), positive current into the network; L=[1,2,3] H; R=[1,2,3] kΩ.',
      equation: 'Z3=sL3+R3; Z2=sL2+1/(1/R2+1/Z3); Z=sL1+1/(1/R1+1/Z2).',
      steps: [
        { text: 'In one-port Frequency, sweep Z from 1 Hz to 100 kHz; inspect 1 kHz.', action: 'port-frequency' },
        { text: 'Inspect DC Z=6000/11 Ω, then increase frequency and compare Z/s with L1.', action: 'port-frequency' },
      ], compare: 'At high frequency Z−sL1 tends to R1. Continued fractions correspond to physical series/shunt layers; driving-point realization differs from arbitrary voltage-transfer synthesis.' },
    { question: 'Цуваа L ба шунт R оролтын туйлаас яаж харагдах вэ?',
      conditions: 'Байнгын хөтлөлт, ачаалалгүй. Туйл (in,0), эерэг гүйдэл сүлжээнд орно; L=[1,2,3] H; R=[1,2,3] кΩ.',
      equation: 'Z3=sL3+R3; Z2=sL2+1/(1/R2+1/Z3); Z=sL1+1/(1/R1+1/Z2).',
      steps: [
        { text: 'Нэг туйлын давтамжийн самбарт Z-г 1 Hz-ээс 100 kHz хүртэл тооцож, 1 kHz-г шалга.', action: 'port-frequency' },
        { text: 'DC-д Z=6000/11 Ω-г үзээд давтамж өсгөж Z/s-г L1-тэй харьцуул.', action: 'port-frequency' },
      ], compare: 'Өндөр давтамжид Z−sL1→R1. Үргэлжилсэн бутархай нь бодит цуваа/шунт шаттай тохирно; оролтын импедансын нийлэгжүүлэлт дурын хүчдэлийн дамжуулалтаас өөр.' }),
};
