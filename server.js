const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 8080;

app.use(express.json());
app.use(cors());

// 사용자, 도서, 예약 정보
let users = [];
let books = [];
let reservations = [];

// users.csv에서 사용자 정보 (userid,password,name)
function loadUsersFromCSV() {
    const csvFilePath = path.join(__dirname, 'users.csv');
    console.log(`Loading users from: ${csvFilePath}`);
    if (fs.existsSync(csvFilePath)) {
        console.log('users.csv 파일이 존재합니다.');
        const csv = fs.readFileSync(csvFilePath, 'utf-8');
        const rows = csv.split(/\r?\n/).filter(row => row.trim() !== "");
        rows.forEach(row => {
            const data = row.split(",");
            if (data.length < 3) {
                console.warn(`잘못된 형식의 사용자 행 발견: ${row}`);
                return;
            }
            users.push({ userid: data[0], password: data[1], name: data[2] });
            console.log('Loaded user:', { userid: data[0], password: data[1], name: data[2] });
        });
        console.log('users.csv 파일 로드 완료');
    } else {
        console.error('users.csv 파일을 찾을 수 없습니다.');
    }
}

// books.csv에서 도서 정보 (id,title,author,genre,isAvailable)
function loadBooksFromCSV() {
    const csvFilePath = path.join(__dirname, 'books.csv');
    console.log(`Loading books from: ${csvFilePath}`);
    if (fs.existsSync(csvFilePath)) {
        console.log('books.csv 파일이 존재합니다.');
        const csv = fs.readFileSync(csvFilePath, 'utf-8');
        const rows = csv.split(/\r?\n/).filter(row => row.trim() !== "");
        rows.shift(); // 헤더 제거
        rows.forEach(row => {
            const data = row.split(",");
            if (data.length < 5) {
                console.warn(`잘못된 형식의 도서 행 발견: ${row}`);
                return;
            }
            const id = parseInt(data[0], 10);
            const title = data[1];
            const author = data[2];
            const genre = data[3];
            const isAvailable = (data[4].toLowerCase() === "true");
            books.push({ id, title, author, genre, isAvailable });
            console.log('Loaded book:', { id, title, author, genre, isAvailable });
        });
        console.log('books.csv 파일 로드 완료');
    } else {
        console.error('books.csv 파일을 찾을 수 없습니다.');
    }
}

loadUsersFromCSV();
loadBooksFromCSV();

// 새로운 사용자 정보를 users.csv에 추가하는 함수
function writeUserToCSV(user) {
    fs.appendFileSync("users.csv", `${user.userid},${user.password},${user.name}\n`, "utf-8");
}

// 아이디 중복확인
app.get('/idcheck/:id', (req, res) => {
    const { id } = req.params;
    const userExists = users.some(u => u.userid === id);
    res.json({ message: userExists ? "존재하는 아이디 입니다." : "사용가능한 아이디입니다." });
});

// 비밀번호 확인
app.post('/pwcheck', (req, res) => {
    const { password, confirmPassword } = req.body;
    const msg = (password && confirmPassword && password === confirmPassword) 
        ? "비밀번호가 일치합니다." 
        : "비밀번호가 일치하지 않습니다.";
    res.json({ message: msg });
});

// 회원가입
app.post('/register', (req, res) => {
    const { userid, password, name } = req.body;

    console.log("등록 요청:", { userid, password, name });

    // 이름 길이 검증
    if (!name || name.length < 3) {
        return res.json({ message: "3글자 이상으로 입력해주세요" });
    }

    const userExists = users.some(u => u.userid === userid);
    if (userExists) {
        console.log("중복된 ID:", userid);
        return res.json({ message: "회원가입 실패" });
    }

    const newUser = { userid, password, name };
    users.push(newUser);
    writeUserToCSV(newUser);

    console.log("회원가입 성공:", newUser);
    res.json({ message: "회원가입 성공" });
});

// 로그인
app.post('/login', (req, res) => {
    const { userid, password } = req.body;
    const user = users.find(u => u.userid === userid && u.password === password);
    const msg = user ? "로그인에 성공했습니다." : "로그인에 실패했습니다.";
    res.json({ message: msg });
});

// 도서조회
app.get('/books', (req, res) => {
    const { title } = req.query;
    let filteredBooks = books;
    if (title && title.trim() !== '') {
        filteredBooks = books.filter(book =>
            book.title.toLowerCase().includes(title.toLowerCase())
        );
    }
    console.log('Filtered books:', filteredBooks);
    res.json(filteredBooks);
});

// 도서예약
app.post('/reserve', (req, res) => {
    const { userid, bookTitle } = req.body;

    const user = users.find(u => u.userid === userid);
    if (!user) {
        return res.json({ message: "예약이 불가능한 도서입니다." });
    }

    const book = books.find(b => b.title.toLowerCase() === bookTitle.toLowerCase());
    if (!book || !book.isAvailable) {
        return res.json({ message: "예약이 불가능한 도서입니다." });
    }

    book.isAvailable = false;
    const currentDate = new Date().toLocaleDateString('en-CA');
    console.log(`Reservation made on: ${currentDate} for book ID: ${book.id}`);

    reservations = reservations.filter(r => r.bookId !== book.id);

    reservations.push({
        bookId: book.id,
        userid: user.userid,
        name: user.name,
        title: book.title,
        author: book.author,
        genre: book.genre,
        reservationDate: currentDate
    });

    res.json({ message: "예약 성공!" });
});

// 나의 예약 조회
app.get('/reservations/:name', (req, res) => {
    const { name } = req.params;
    const user = users.find(u => u.name === name);
    if (!user) {
        return res.json([]);
    }
    const userReservations = reservations.filter(r => r.userid === user.userid);
    res.json(userReservations);
});

// 관리자 예약 목록 조회: 모든 예약 정보
app.get('/admin/reservations', (req, res) => {
    res.json(reservations);
});

// 관리자 기능1: 도서추가
app.post('/admin/book', (req, res) => {
    const { id, title, author, genre } = req.body;
    if (!id || !title || !author || !genre) {
        return res.sendStatus(400);
    }

    const exists = books.some(book => book.id === id);
    if (exists) {
        return res.sendStatus(400);
    }

    books.push({ id, title, author, genre, isAvailable: true });
    res.sendStatus(200);
});

// 관리자 기능2: 도서수정
app.put('/admin/book/:id', (req, res) => {
    const { id } = req.params;
    const { title, author, genre, isAvailable } = req.body;

    const book = books.find(b => b.id == id);
    if (!book) {
        return res.sendStatus(404);
    }

    if (title !== undefined) book.title = title;
    if (author !== undefined) book.author = author;
    if (genre !== undefined) book.genre = genre;
    if (isAvailable !== undefined) book.isAvailable = !!isAvailable;

    res.sendStatus(200);
});

// 관리자 기능3: 도서삭제
app.delete('/admin/book/:id', (req, res) => {
    const { id } = req.params;
    const index = books.findIndex(b => b.id == id);
    if (index === -1) {
        return res.sendStatus(404);
    }

    reservations = reservations.filter(r => r.bookId != id);
    books.splice(index, 1);
    res.sendStatus(200);
});

// 관리자 기능4: 예약상태전환
app.put('/admin/book/:id/reservation', (req, res) => {
    const { id } = req.params;
    const { isAvailable } = req.body;

    const book = books.find(b => b.id == id);
    if (!book) {
        return res.sendStatus(404);
    }

    book.isAvailable = Boolean(isAvailable);
    if (book.isAvailable) {
        reservations = reservations.filter(r => r.bookId != book.id);
    }
    res.sendStatus(200);
});

// 관리자 기능5: 예약자조회
app.get('/admin/book/:id/reservation', (req, res) => {
    const { id } = req.params;
    const reservation = reservations.find(r => r.bookId == id);

    if (!reservation) {
        return res.json({});
    }

    res.json({
        name: reservation.name,
        reservationDate: reservation.reservationDate
    });
});

// 서버 시작
app.listen(PORT, () => {
    console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
});

module.exports = app;