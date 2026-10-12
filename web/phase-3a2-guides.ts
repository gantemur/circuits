import type { Bilingual } from './study-guide.js';

/** These experiments refer to the declared terminal model, not an ideal diode. */
export const phase3a2Lessons: Readonly<Record<string, Bilingual>> = {
  'diode-single': {
    en: {
      question: 'Where does the source–resistor load line meet the diode curve?',
      conditions: '1 V DC source, 1 kΩ external resistor, one Shockley diode; the browser AC increment is 1 mV RMS.',
      equation: 'I=(E−Vd)/R and Vd=vj+Rs·I; rd=dVd/dI, not Vd/I.',
      steps: [
        { text: 'Open DC and compare Vd, signed Id, rd, and Vd/Id at the solved Q point.', action: 'dc' },
        { text: 'Open Diode characteristic; compare its Q marker, local tangent, and external load line. Change source DC and fit the curve to the new bias.', action: 'diode-characteristic' },
        { text: 'Run a DC source sweep from 0 to 2 V; failed points appear as gaps, not interpolated answers.', action: 'dc-sweep' },
      ],
      compare: 'Changing source DC moves Q and changes the local slope; Newton iterations are not elapsed physical time.',
    },
    mn: {
      question: 'Үүсгүүр–эсэргүүцлийн ачааллын шулуун диодын муруйтай хаана огтлолцох вэ?',
      conditions: '1 V тогтмол үүсгүүр, гаднах 1 кΩ эсэргүүцэл, нэг Шоклийн диод; хөтчийн AC бага дохио 1 мВ RMS.',
      equation: 'I=(E−Vd)/R ба Vd=vj+Rs·I; rd=dVd/dI, Vd/I биш.',
      steps: [
        { text: 'DC шинжилгээнд Vd, тэмдэгтэй Id, rd болон Vd/Id-г шийдсэн Q цэгт харьцуул.', action: 'dc' },
        { text: 'Диодын тодорхойлолтод Q тэмдэглэгээ, орон нутгийн шүргэгч, гаднах ачааллын шулууныг хар. Үүсгүүрийн DC утгыг өөрчлөөд муруйг шинэ ажлын цэгт тааруул.', action: 'diode-characteristic' },
        { text: '0–2 V мужид DC үүсгүүрийг тооцоолон гүйлгэ; амжилтгүй цэгийг зохиомол утгаар нөхөхгүй.', action: 'dc-sweep' },
      ],
      compare: 'Үүсгүүрийн DC утга Q цэг болон орон нутгийн налууг өөрчилнө; Ньютоны давталт нь физик хугацаа биш.',
    },
  },
  'diode-series': {
    en: {
      question: 'How does internal diode series resistance change terminal voltage?',
      conditions: 'The 10 Ω internal Rs is part of the diode; the external resistor remains a separate branch.',
      equation: 'Vterminal=vj+Rs·I; rd=Rs+η/(Is·exp(vj/η)).',
      steps: [
        { text: 'In DC, compare junction and terminal voltage and their signed current.', action: 'dc' },
        { text: 'In Diode characteristic, increase Rs and compare the local tangent with the original curve.', action: 'diode-characteristic' },
        { text: 'In Frequency, compare the 1 mV RMS incremental response after changing the DC bias.', action: 'frequency' },
      ],
      compare: 'Rs is a model parameter. The plotted terminal curve includes its voltage drop, especially at larger current.',
    },
    mn: {
      question: 'Диодын дотоод цуваа эсэргүүцэл үзүүрийн хүчдэлийг яаж өөрчлөх вэ?',
      conditions: 'Дотоод Rs=10 Ω нь диодын загварт багтана; гаднах эсэргүүцэл тусдаа мөчир хэвээр.',
      equation: 'Vterminal=vj+Rs·I; rd=Rs+η/(Is·exp(vj/η)).',
      steps: [
        { text: 'DC шинжилгээнд уулзварын ба үзүүрийн хүчдэл, тэмдэгтэй гүйдлийг харьцуул.', action: 'dc' },
        { text: 'Диодын тодорхойлолтод Rs-г өсгөж орон нутгийн шүргэгч, анхны муруйг харьцуул.', action: 'diode-characteristic' },
        { text: 'Давтамжийн шинжилгээнд DC ажлын цэгийг өөрчилсний дараах 1 мВ RMS бага дохионы хариуг харьцуул.', action: 'frequency' },
      ],
      compare: 'Rs нь загварын параметр. Үзүүрийн муруйд ялангуяа их гүйдэлд түүний хүчдэлийн уналт орно.',
    },
  },
  'diode-pair': {
    en: {
      question: 'Why is an antiparallel pair a coupled nonlinear circuit?',
      conditions: 'Two opposed diodes share the same external node; their terminal currents sum by KCL.',
      equation: 'Iexternal=ID+ − ID− at out; ID− is oriented from 0 to out.',
      steps: [
        { text: 'In DC, inspect the signed currents of both diode branches.', action: 'dc' },
        { text: 'Run a source sweep from −2 to +2 V and inspect both polarities.', action: 'dc-sweep' },
        { text: 'Select each diode separately in Diode characteristic; there is no single-diode external load line for the coupled pair.', action: 'diode-characteristic' },
      ],
      compare: 'A device curve is useful, but only the complete network determines its Q point.',
    },
    mn: {
      question: 'Эсрэг чиглэлийн хоёр диод яагаад харилцан хамааралтай шугаман бус хэлхээ вэ?',
      conditions: 'Хоёр диод нэг гаднах зангилааг хуваалцана; тэдний гүйдэл KCL-ээр нийлнэ.',
      equation: 'out зангилаанд Iexternal=ID+ − ID−; ID− нь 0-ээс out руу чиглэнэ.',
      steps: [
        { text: 'DC шинжилгээнд хоёр диодын мөчрийн тэмдэгтэй гүйдлийг үз.', action: 'dc' },
        { text: 'Үүсгүүрийг −2-оос +2 V хүртэл тооцоолон гүйлгэж хоёр туйлыг үз.', action: 'dc-sweep' },
        { text: 'Диодын тодорхойлолтод диод бүрийг тусад нь сонго; энэ хосод нэг диодын гаднах ачааллын шулуун байхгүй.', action: 'diode-characteristic' },
      ],
      compare: 'Төхөөрөмжийн муруй хэрэгтэй боловч түүний Q цэгийг бүтэн хэлхээ тодорхойлно.',
    },
  },
  'diode-rc': {
    en: {
      question: 'How does a DC bias change an RC section’s small-signal frequency response?',
      conditions: 'The capacitor is open for DC bias; at frequency it contributes sC. The source AC value is 1 mV RMS.',
      equation: 'HQ(s)=(1/R)/(1/R+gterminal+sC); gterminal=1/rd at Q.',
      steps: [
        { text: 'In DC, change the source DC level and compare the diode local resistance.', action: 'dc' },
        { text: 'In Frequency, inspect the incremental gain near 3.13 kHz at the baseline bias and its configured RMS voltage.', action: 'frequency' },
        { text: 'In Equations, distinguish the nonlinear augmented residual from the linearized tangent matrices.', action: 'equations' },
      ],
      compare: 'The shown gain is a local derivative for this bias; it is not the absolute nonlinear DC output divided by the source.',
    },
    mn: {
      question: 'DC ажлын цэг RC шатны бага дохионы давтамжийн хариуг яаж өөрчлөх вэ?',
      conditions: 'Конденсатор DC-д нээлттэй; давтамжид sC хувь нэмэртэй. Үүсгүүрийн AC утга 1 мВ RMS.',
      equation: 'HQ(s)=(1/R)/(1/R+gterminal+sC); Q цэгт gterminal=1/rd.',
      steps: [
        { text: 'DC шинжилгээнд үүсгүүрийн DC түвшнийг өөрчилж диодын орон нутгийн эсэргүүцлийг харьцуул.', action: 'dc' },
        { text: 'Давтамжийн шинжилгээнд суурь ажлын цэгийн 3.13 кГц орчмын бага дохионы өсгөлт, RMS хүчдэлийг үз.', action: 'frequency' },
        { text: 'Тэгшитгэлд шугаман бус өргөтгөсөн үлдэгдэл ба шугаманчилсан шүргэгч матрицыг ялга.', action: 'equations' },
      ],
      compare: 'Энэ өсгөлт нь тухайн ажлын цэгийн орон нутгийн уламжлал; үнэмлэхүй DC гаралтыг үүсгүүрт хуваасан утга биш.',
    },
  },
};
