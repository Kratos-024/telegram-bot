-- CreateTable
CREATE TABLE "User" (
    "id" BIGSERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "chatId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" SERIAL NOT NULL,
    "imageFileId" TEXT,
    "gameId" TEXT,
    "matchPassword" TEXT,
    "gameName" TEXT NOT NULL,
    "matchName" TEXT NOT NULL,
    "netPrizePool" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "price" DOUBLE PRECISION NOT NULL,
    "perKillPoint" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "firstPrize" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "secondPrize" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "thirdPrize" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "entryFees" DOUBLE PRECISION NOT NULL,
    "totalSeats" INTEGER NOT NULL,
    "time" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'upcoming',
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" SERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "matchId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchEntry" (
    "id" SERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "matchId" INTEGER NOT NULL,
    "amountPaid" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchHistory" (
    "id" SERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "originalMatchId" INTEGER NOT NULL,
    "gameName" TEXT NOT NULL,
    "matchName" TEXT NOT NULL,
    "amountPaid" DOUBLE PRECISION NOT NULL,
    "prizeWon" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "killCount" INTEGER NOT NULL DEFAULT 0,
    "position" INTEGER,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'participated',
    "matchDate" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entryFees" DOUBLE PRECISION NOT NULL,
    "totalSeats" INTEGER NOT NULL,
    "netPrizePool" DOUBLE PRECISION NOT NULL,
    "perKillPoint" DOUBLE PRECISION NOT NULL,
    "firstPrize" DOUBLE PRECISION NOT NULL,
    "secondPrize" DOUBLE PRECISION NOT NULL,
    "thirdPrize" DOUBLE PRECISION NOT NULL,
    "matchTime" TEXT NOT NULL,

    CONSTRAINT "MatchHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_chatId_key" ON "User"("chatId");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_userId_matchId_key" ON "Purchase"("userId", "matchId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchEntry_userId_matchId_key" ON "MatchEntry"("userId", "matchId");

-- CreateIndex
CREATE INDEX "MatchHistory_userId_idx" ON "MatchHistory"("userId");

-- CreateIndex
CREATE INDEX "MatchHistory_originalMatchId_idx" ON "MatchHistory"("originalMatchId");

-- CreateIndex
CREATE INDEX "MatchHistory_matchDate_idx" ON "MatchHistory"("matchDate");

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchEntry" ADD CONSTRAINT "MatchEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchEntry" ADD CONSTRAINT "MatchEntry_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchHistory" ADD CONSTRAINT "MatchHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
