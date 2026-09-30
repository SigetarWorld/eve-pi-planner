// Калькулятор ISK/час на вкладке «Калькулятор».
//
// Считать пока нечем: для расчёта нужны два источника, которых
// в проекте ещё нет.
//   1. Цена за единицу ресурса в ISK — живая, её отдаёт ESI:
//      esi.evetech.net/v2/markets/prices/?type_id=<typeID>
//   2. Время цикла и вместимость силоса по типу ресурса — это
//      planetResources из официального SDE. В выгрузке, которую
//      скачивали при сверке data.js, записей по PI-ресурсам нет.
// Пока обоих источников нет, результат не выдумывается: форма
// подтверждает введённые числа и говорит, чего не хватает.

// Смысл этого файла — не дать форме отправиться и перезагрузить
// страницу. У <form> не задан action, а кнопка по умолчанию имеет
// type="submit", поэтому без preventDefault нажатие «Рассчитать»
// перезагружает страницу и сбрасывает вкладку на первую.

const calcForm = document.getElementById('calc-form');

if (calcForm) {
    calcForm.addEventListener('submit', (event) => {
        event.preventDefault();

        const result = document.getElementById('calc-result');
        if (!result) return;

        const extractors = document.getElementById('extractors').value;
        const cycleTime = document.getElementById('cycle-time').value;

        // Собираем через textContent, а не через innerHTML:
        // числа приходят из полей ввода, то есть от пользователя.
        const lines = [
            `Введено экстракторов: ${extractors}, цикл: ${cycleTime} ч.`,
            'Посчитать пока нечем: нужны цена ISK за единицу из ESI ' +
            'и время цикла по типу ресурса из SDE.'
        ];

        result.replaceChildren(...lines.map((text) => {
            const p = document.createElement('p');
            p.textContent = text;
            return p;
        }));
    });
}
