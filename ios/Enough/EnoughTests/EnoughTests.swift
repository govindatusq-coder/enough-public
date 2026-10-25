import XCTest
@testable import Enough

/// Parity checks against the website's `lib/*.ts` behaviour and account format.
final class CatalogueTests: XCTestCase {
    func testLibraryMatchesWebIdsAndCount() {
        let ideas = Catalogue.ideas
        XCTAssertEqual(ideas.count, 59)
        XCTAssertEqual(Set(ideas.map(\.id)).count, 59)
        XCTAssertEqual(Set(ideas.map(\.id)), Set(0...60).subtracting([2, 13]), "The web id formula skips 2 and 13")
        XCTAssertEqual(Catalogue.byId(0)?.title, "Dinner, with a little fresh air.")
        XCTAssertEqual(Catalogue.byId(0)?.moneyCents, 699)
        XCTAssertEqual(Catalogue.byId(0)?.moneySource, .feeAvoided)
        XCTAssertEqual(Catalogue.byId(1)?.title, "Your next catch-up. Out in the world.")
        XCTAssertEqual(Catalogue.byId(1)?.minutes, 12)
        XCTAssertEqual(Catalogue.byId(46)?.key, "ad-break-wall-pushups")
        XCTAssertEqual(Catalogue.byId(60)?.key, "commute-wait-loop")
        XCTAssertNil(Catalogue.byId(2))
        XCTAssertEqual(Catalogue.byId(3)?.key, "call-pace-indoors")
    }

    func testDerivedFieldsMatchWeb() throws {
        let coffee = try XCTUnwrap(Catalogue.ideas.first { $0.key == "coffee-walk-home" })
        XCTAssertEqual(coffee.moneySource, .purchaseAvoided)
        let post = try XCTUnwrap(Catalogue.ideas.first { $0.key == "post-walk" })
        XCTAssertEqual(post.moneySource, .transportAvoided)
        XCTAssertEqual(post.output, "Post office on foot")
        XCTAssertEqual(post.mechanism, "substitute")
        let stretch = try XCTUnwrap(Catalogue.ideas.first { $0.key == "break-stretch" })
        XCTAssertEqual(stretch.movementMode, "seated")
        XCTAssertFalse(stretch.breaksSitting)
        let refill = try XCTUnwrap(Catalogue.ideas.first { $0.key == "water-refill-far" })
        XCTAssertEqual(refill.movementMode, "stairs")
        XCTAssertEqual(refill.intensity, .moderate)
        XCTAssertEqual(coffee.promised, [.movement, .moneySaved, .experience])
        XCTAssertEqual(post.promised, [.movement, .moneySaved, .experience, .taskCompleted])
        XCTAssertTrue(Catalogue.ideas.allSatisfy(IdeaMovement.hasMovement))
    }

    func testSittingBreaksCarryExclusions() throws {
        let run = try XCTUnwrap(Catalogue.ideas.first { $0.key == "library-easy-run" })
        XCTAssertEqual(run.exclude, ["Physical limitations", "Recovery needs", "Fatigue", "Safety", "Weather", "Walkability"])
        XCTAssertEqual(run.effort, .moderate)
        XCTAssertEqual(run.image, "welcome-library-run")
    }
}

final class AccountFormatTests: XCTestCase {
    private func fixture() throws -> Data {
        let url = try XCTUnwrap(Bundle(for: AccountFormatTests.self).url(forResource: "web-account", withExtension: "json"))
        return try Data(contentsOf: url)
    }

    func testWebAccountDecodesAndRoundTrips() throws {
        let data = try fixture()
        let state = try Journey.validate(try JSONDecoder().decode(AppState.self, from: data))
        XCTAssertEqual(state.profile.name, "Sam")
        XCTAssertTrue(state.profile.isComplete)
        XCTAssertEqual(state.entries.count, 3)
        XCTAssertEqual(state.entries[0].movementEvidence?.steps, 1420)
        XCTAssertNil(state.entries[0].movementEvidence?.exerciseMinutes)
        XCTAssertEqual(state.entries[0].support?.qrMeet, true)
        XCTAssertEqual(state.generated?.first?.id, 1001)
        XCTAssertEqual(state.aiConsent?.choice, .withoutHealth)

        let encoded = try JSONEncoder.account.encode(state)
        let original = try JSONSerialization.jsonObject(with: data) as! NSDictionary
        let again = try JSONSerialization.jsonObject(with: encoded) as! NSDictionary
        XCTAssertEqual(again, original, "Re-encoding must not add, drop or rename keys the web schema checks strictly")
    }

    func testEmptyStateEncodesOnlyRequiredKeys() throws {
        let json = try JSONSerialization.jsonObject(with: try JSONEncoder.account.encode(AppState.empty)) as! [String: Any]
        XCTAssertEqual(Set(json.keys), ["version", "demo", "today", "profile", "saved", "entries"])
        let profile = json["profile"] as! [String: Any]
        XCTAssertEqual(profile["currency"] as? String, "AUD")
        XCTAssertNil(profile["country"])
    }

    func testMovementSettingsAlwaysWriteThreshold() throws {
        let json = try JSONSerialization.jsonObject(with: try JSONEncoder.account.encode(MovementSettings(metric: .steps, threshold: nil, quietChoice: QuietChoice.none))) as! [String: Any]
        XCTAssertTrue(json.keys.contains("threshold"))
        XCTAssertTrue(json["threshold"] is NSNull)
    }
}

final class JourneyTests: XCTestCase {
    private func completeState() -> AppState {
        var s = AppState.empty
        s.profile = Profile(name: "", preferences: ["Outside"], interests: ["Podcasts"], needs: ["Nothing to add"], strengths: ["I keep routines"], activity: "Mostly seated", rhythms: ["Calls"], window: "Evening", currency: "AUD", visual: [], complete: true)
        return s
    }

    func testAcceptNeedsDemoAndCompleteProfile() {
        var s = AppState.empty
        XCTAssertTrue(Journey.accept(s, ideaId: 0).entries.isEmpty)
        s = completeState(); s.demo = true
        let accepted = Journey.accept(s, ideaId: 0)
        XCTAssertEqual(accepted.entries.count, 1)
        XCTAssertEqual(accepted.entries[0].predicted, [.movement, .moneySaved, .experience, .taskCompleted, .timeSaved])
        XCTAssertEqual(Journey.accept(accepted, ideaId: 0).entries.count, 1, "An idea is planned once")
    }

    func testFinishRecordsOutcomeAndReceiptCounts() throws {
        var s = completeState(); s.demo = true
        s = Journey.accept(s, ideaId: 0)
        let id = s.entries[0].id
        s = try Journey.finish(s, entryId: id, outcome: Journey.Outcome(minutes: 18, outside: true, connecting: false, worthwhile: true, moneyCents: 699))
        XCTAssertEqual(s.entries[0].status, .completed)
        let report = Journey.receipt(s.entries, period: .today, currency: "AUD")
        XCTAssertEqual(report.money, 699)
        XCTAssertEqual(report.outside, 18)
        XCTAssertEqual(report.connecting, 0)
        XCTAssertEqual(report.worthwhile, 1)
        XCTAssertEqual(Journey.receipt(s.entries, period: .today, currency: "USD").money, 0, "Currencies are never combined")
        XCTAssertThrowsError(try Journey.finish(s, entryId: id, outcome: Journey.Outcome(minutes: 300, outside: false, connecting: false, worthwhile: true, moneyCents: 0)))
    }

    func testResumeStep() {
        XCTAssertEqual(Onboarding.resumeStep(Profile()), 0)
        var p = Profile(); p.preferences = ["Outside"]
        XCTAssertEqual(Onboarding.resumeStep(p), 2)
        p.interests = ["Music"]; p.needs = ["Not enough time"]; p.strengths = ["I keep routines"]
        XCTAssertEqual(Onboarding.resumeStep(p), 5)
    }
}

final class RecommendationTests: XCTestCase {
    private func state(needs: [String]) -> AppState {
        var s = AppState.empty
        s.profile = Profile(name: "", preferences: ["Outside"], interests: ["Podcasts"], needs: needs, strengths: ["I keep routines"], activity: "Mostly seated", rhythms: ["Calls"], window: "Evening", currency: "AUD", visual: [], complete: true)
        return s
    }

    func testNeedsAreHardBoundaries() throws {
        let noon = Calendar.current.date(bySettingHour: 12, minute: 0, second: 0, of: Date())!
        let safe = state(needs: ["Safety matters"])
        XCTAssertFalse(Recommendations.recommend(safe, now: noon).contains { $0.idea.outdoor })
        let seated = state(needs: ["Physical comfort / accessibility"])
        XCTAssertTrue(Recommendations.recommend(seated, now: noon).allSatisfy { $0.idea.movementMode == "seated" })
        let open = state(needs: ["Nothing to add"])
        let feed = Recommendations.recommend(open, now: noon)
        XCTAssertFalse(feed.isEmpty)
        XCTAssertTrue(feed.allSatisfy { $0.score >= 6 })
        XCTAssertLessThanOrEqual(feed.prefix(5).filter { $0.idea.movementMode == "walk" }.count, 2 + max(0, 5 - feed.count), "The first five results are not all walks")
    }

    func testFreeTextNeedPausesSuggestions() {
        let s = state(needs: ["Something else: knees"])
        XCTAssertTrue(Recommendations.recommend(s).isEmpty)
    }

    func testMoneyValuePrefersConfirmedThenCostThenLibrary() throws {
        var s = state(needs: ["Nothing to add"])
        let dinner = try XCTUnwrap(Catalogue.byId(0))
        XCTAssertEqual(Recommendations.moneyValue(dinner, s)?.cents, 699)
        s.costs = [Cost(ideaId: 0, currency: "AUD", usualCents: 1200, moveCents: 300, updatedAt: ISO.string())]
        XCTAssertEqual(Recommendations.moneyValue(dinner, s)?.cents, 900)
        s.profile.currency = "USD"
        XCTAssertNil(Recommendations.moneyValue(dinner, s))
    }
}

final class RegionAndMovementTests: XCTestCase {
    func testParseMoney() {
        XCTAssertEqual(Regions.parseMoney("12.5"), 1250)
        XCTAssertEqual(Regions.parseMoney("1000"), 100_000)
        XCTAssertNil(Regions.parseMoney("1000.01"))
        XCTAssertNil(Regions.parseMoney("-1"))
        XCTAssertNil(Regions.parseMoney("1.234"))
    }

    func testFormatMoneyUsesIsoCode() {
        XCTAssertTrue(Regions.formatMoney(699, currency: "AUD", country: "AU").contains("6.99"))
        XCTAssertTrue(Regions.formatMoney(699, currency: "AUD", country: "AU").contains("AUD"))
    }

    func testSuggestedThresholdNeedsSevenReadableDays() {
        let now = Date(), tz = TimeZone.current.identifier
        let cal = Calendar.current
        func days(_ count: Int) -> [MovementDay] {
            (1...count).map { offset in MovementDay(date: localDate(cal.date(byAdding: .day, value: -offset, to: now)!), steps: Double(1000 * offset), exerciseMinutes: nil) }
        }
        XCTAssertNil(Movement.suggestedThreshold(MovementSnapshot(source: .appleHealth, timezone: tz, readAt: ISO.string(now), days: days(6)), metric: .steps, now: now))
        XCTAssertEqual(Movement.suggestedThreshold(MovementSnapshot(source: .appleHealth, timezone: tz, readAt: ISO.string(now), days: days(7)), metric: .steps, now: now), 4000)
    }

    func testEnoughTodayNeedsFreshSnapshotAndChosenAmount() {
        let now = Date()
        let snapshot = MovementSnapshot(source: .appleHealth, timezone: TimeZone.current.identifier, readAt: ISO.string(now), days: [MovementDay(date: localDate(now), steps: 7000, exerciseMinutes: 10)])
        XCTAssertTrue(Movement.enoughToday(snapshot, settings: MovementSettings(metric: .steps, threshold: 6000, quietChoice: .amount), now: now))
        XCTAssertFalse(Movement.enoughToday(snapshot, settings: MovementSettings(metric: .steps, threshold: nil, quietChoice: QuietChoice.none), now: now))
        XCTAssertFalse(Movement.enoughToday(snapshot, settings: MovementSettings(metric: .steps, threshold: 6000, quietChoice: .amount), now: now.addingTimeInterval(16 * 60)), "Readings older than fifteen minutes are stale")
    }

    func testMeetingCodeRoundTrip() throws {
        let code = try MeetingCode.make(name: " Jo ")
        XCTAssertEqual(try MeetingCode.read(code), "Jo")
        XCTAssertThrowsError(try MeetingCode.read("{\"app\":\"OTHER\",\"version\":1,\"name\":\"x\"}"))
        XCTAssertThrowsError(try MeetingCode.add([], name: "", source: .manual))
    }

    func testDescribesMovementMatchesWebRules() {
        XCTAssertTrue(IdeaMovement.describesMovement(mode: "walk", text: "Walk a slow lap of the kitchen while the kettle boils"))
        XCTAssertFalse(IdeaMovement.describesMovement(mode: "walk", text: "Think about walking later"))
        XCTAssertFalse(IdeaMovement.describesMovement(mode: "walk", text: "Stay seated and avoid walking"))
        XCTAssertFalse(IdeaMovement.describesMovement(mode: "seated", text: "Stretch your fingers"))
        XCTAssertTrue(IdeaMovement.describesMovement(mode: "seated", text: "Stretch your arms and shoulders slowly"))
    }
}

/// The website stores fields this app doesn't model yet (the Life Map,
/// opportunity feedback and "did it happen" moments). Saving from the app must
/// send them back untouched, never erase them.
final class AccountPreservationTests: XCTestCase {
    func testKnownFieldsMatchTheModel() {
        XCTAssertEqual(AccountFields.known, ["version", "weeklyReviews", "aiConsent", "costs", "movementSettings", "profile", "saved", "entries", "demo", "today", "generated", "passes", "tuning"])
    }

    func testWebOnlyFieldsSurviveAnAppSave() throws {
        let lifeMap: [String: Any] = ["version": 1, "contexts": ["kids", "calls"], "onboardingCompleted": true]
        let feedback: [[String: Any]] = [["id": "f1", "opportunityId": "call-listening-walk", "response": "accept"]]
        var stateObject = try XCTUnwrap(JSONSerialization.jsonObject(with: JSONEncoder.account.encode(AppState.empty)) as? [String: Any])
        stateObject["lifeMap"] = lifeMap
        stateObject["opportunityFeedback"] = feedback
        let account = try JSONSerialization.data(withJSONObject: ["revision": 3, "state": stateObject])

        let extras = AccountFields.extras(fromAccountJSON: account)
        XCTAssertEqual(Set(extras.keys), ["lifeMap", "opportunityFeedback"])

        var edited = AppState.empty
        edited.saved = [1]
        let merged = try AccountFields.merged(JSONEncoder.account.encode(edited), extras: extras)
        XCTAssertEqual(merged["saved"] as? [Int], [1], "the app's own fields win")
        XCTAssertEqual((merged["lifeMap"] as? [String: Any])?["contexts"] as? [String], ["kids", "calls"])
        XCTAssertEqual((merged["opportunityFeedback"] as? [[String: Any]])?.first?["opportunityId"] as? String, "call-listening-walk")
    }

    func testAnAccountWithoutWebFieldsHasNoExtras() throws {
        let account = try JSONSerialization.data(withJSONObject: ["revision": 1, "state": try XCTUnwrap(JSONSerialization.jsonObject(with: JSONEncoder.account.encode(AppState.empty)))])
        XCTAssertTrue(AccountFields.extras(fromAccountJSON: account).isEmpty)
    }
}
